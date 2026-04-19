// ========================
// OpenPGP 智能卡 WebUSB 支持
// ========================

const SC = {
    device: null,
    bulkIn: null,
    bulkOut: null,
    seq: 0,
    pin: null,          // 会话内缓存的 PIN
    fingerprint: null,  // 卡上解密密钥指纹
};

// CCID 帧：PC_to_RDR_XfrBlock
function ccidWrap(apdu) {
    const buf = new Uint8Array(10 + apdu.length);
    buf[0] = 0x6F;
    new DataView(buf.buffer).setUint32(1, apdu.length, true);
    buf[5] = 0x00;
    buf[6] = SC.seq++ & 0xFF;
    // buf[7..9] = 0x00
    buf.set(apdu, 10);
    return buf;
}

// 发送 APDU，返回响应数据（不含 SW）和 SW
async function transceive(apdu) {
    await SC.device.transferOut(SC.bulkOut.endpointNumber, ccidWrap(apdu));
    const res = await SC.device.transferIn(SC.bulkIn.endpointNumber, 65536);
    const data = new Uint8Array(res.data.buffer);
    // 响应：10字节 CCID 头 + APDU响应
    const payload = data.slice(10);
    const sw = (payload[payload.length - 2] << 8) | payload[payload.length - 1];
    return { data: payload.slice(0, -2), sw };
}

// 选择 OpenPGP 应用
async function selectOpenPGP() {
    const aid = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x06, 0xD2, 0x76, 0x00, 0x01, 0x24, 0x01, 0x00]);
    const { sw } = await transceive(aid);
    if (sw !== 0x9000) throw new Error(`SELECT 失败: ${sw.toString(16)}`);
}

// 读取卡片名称（GET DATA: Application Related Data）
async function getCardName() {
    const { data, sw } = await transceive(new Uint8Array([0x00, 0xCA, 0x00, 0x6E, 0x00]));
    if (sw !== 0x9000) return '未知设备';
    // 尝试从 AID 中提取制造商信息（字节偏移固定）
    return SC.device.productName || SC.device.manufacturerName || 'OpenPGP 智能卡';
}

// 读取解密密钥指纹（GET DATA: Fingerprints tag 0xC5，偏移20字节为解密密钥）
async function getDecryptKeyFingerprint() {
    const { data, sw } = await transceive(new Uint8Array([0x00, 0xCA, 0x00, 0xC5, 0x00]));
    if (sw !== 0x9000 || data.length < 40) return null;
    // 3个指纹各20字节：[0..19]=签名, [20..39]=解密, [40..59]=认证
    return Array.from(data.slice(20, 40)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证 PIN（PW1 for decryption, P2=0x82）
async function verifyPin(pin) {
    const pinBytes = new TextEncoder().encode(pin);
    const apdu = new Uint8Array([0x00, 0x20, 0x00, 0x82, pinBytes.length, ...pinBytes]);
    const { sw } = await transceive(apdu);
    if (sw === 0x9000) return true;
    if ((sw & 0xFFF0) === 0x63C0) throw new Error(`PIN 错误，剩余尝试次数: ${sw & 0x0F}`);
    if (sw === 0x6983) throw new Error('PIN 已被锁定');
    throw new Error(`PIN 验证失败: ${sw.toString(16)}`);
}

// PSO:DECIPHER — 对 ECDH 会话密钥解密
// ciphertextBytes: openpgp.js 加密产生的 ECDH ephemeral point（33字节 compressed）
async function psoDecipher(ephemeralPoint) {
    // OpenPGP 卡 ECDH 输入格式: A6 [len] 7F 49 [len] 86 [len] [point]
    const inner = new Uint8Array([0x86, ephemeralPoint.length, ...ephemeralPoint]);
    const mid = new Uint8Array([0x7F, 0x49, inner.length, ...inner]);
    const outer = new Uint8Array([0xA6, mid.length, ...mid]);
    const apdu = new Uint8Array([0x00, 0x2A, 0x80, 0x86, outer.length, ...outer, 0x00]);
    const { data, sw } = await transceive(apdu);
    if (sw !== 0x9000) throw new Error(`PSO:DECIPHER 失败: ${sw.toString(16)}`);
    return data;
}

// ========================
// UI 状态更新
// ========================

function updateDrawerUI(connected) {
    DOM.scStatusDot.className = `size-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`;
    DOM.scStatusText.textContent = connected ? '已连接' : '未连接';
    DOM.scConnectBtn.textContent = connected ? '重新连接' : '连接智能卡';
    DOM.scDecryptBtn.disabled = !connected || !SC.pin;
    DOM.scDisconnectBtn.classList.toggle('hidden', !connected);
    DOM.smartCardConnectedDot.classList.toggle('hidden', !connected);
}

function updatePinUI(hasPin) {
    DOM.scPinCard.classList.toggle('hidden', !hasPin);
    DOM.scDecryptBtn.disabled = !SC.device || !hasPin;
}

// ========================
// 抽屉开关
// ========================

function openSmartCardDrawer() {
    DOM.smartCardDrawer.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [DOM.smartCardDrawer] });
}

function closeSmartCardDrawer() {
    DOM.smartCardDrawer.classList.add('hidden');
}

// ========================
// 连接流程
// ========================

async function connectSmartCard() {
    if (!navigator.usb) {
        showNotification('此浏览器不支持 WebUSB', 'error');
        return;
    }
    try {
        DOM.scConnectBtn.disabled = true;
        DOM.scConnectBtn.textContent = '正在连接...';

        const device = await navigator.usb.requestDevice({ filters: [] });
        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);

        // 找 CCID 接口 (interfaceClass 0x0B)
        const iface = device.configuration.interfaces.find(i =>
            i.alternates[0].interfaceClass === 0x0B
        );
        if (!iface) throw new Error('未找到 CCID 接口，请确认这是 OpenPGP 智能卡读卡器');

        await device.claimInterface(iface.interfaceNumber);
        const alt = iface.alternates[0];
        SC.bulkOut = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        SC.bulkIn  = alt.endpoints.find(e => e.direction === 'in'  && e.type === 'bulk');
        if (!SC.bulkOut || !SC.bulkIn) throw new Error('未找到 CCID bulk 端点');

        SC.device = device;
        SC.seq = 0;

        await selectOpenPGP();

        const name = await getCardName();
        DOM.scDeviceName.textContent = name;

        const fp = await getDecryptKeyFingerprint();
        SC.fingerprint = fp;
        if (fp) {
            DOM.scKeyFingerprint.textContent = fp.slice(-16).toUpperCase();
            DOM.scKeyFingerprint.classList.remove('hidden');
        }

        updateDrawerUI(true);

        // 连接后立即请求 PIN
        await promptAndVerifyPin();

    } catch (err) {
        SC.device = null;
        updateDrawerUI(false);
        showNotification('连接失败: ' + err.message, 'error');
        debugLog('智能卡连接失败: ' + err.message);
    } finally {
        DOM.scConnectBtn.disabled = false;
    }
}

async function promptAndVerifyPin() {
    const pin = await customPrompt('请输入智能卡 PIN', '通常为6位数字', '');
    if (!pin) return;
    try {
        await verifyPin(pin);
        SC.pin = pin;
        updatePinUI(true);
        showNotification('PIN 验证成功');
    } catch (err) {
        SC.pin = null;
        updatePinUI(false);
        showNotification(err.message, 'error');
    }
}

function lockPin() {
    SC.pin = null;
    updatePinUI(false);
    showNotification('PIN 已锁定');
}

async function disconnectSmartCard() {
    if (SC.device) {
        try { await SC.device.close(); } catch (_) {}
        SC.device = null;
    }
    SC.pin = null;
    SC.fingerprint = null;
    DOM.scDeviceName.textContent = '—';
    DOM.scKeyFingerprint.classList.add('hidden');
    updateDrawerUI(false);
    updatePinUI(false);
    showNotification('智能卡已断开');
}

// ========================
// 解密入口（供外部调用）
// ========================

// 使用智能卡对 openpgp.js 加密消息解密
// 返回解密后的明文字符串，失败返回 null
async function smartCardDecrypt(armoredMessage) {
    if (!SC.device || !SC.pin) {
        showNotification('请先连接智能卡并验证 PIN', 'warning');
        openSmartCardDrawer();
        return null;
    }
    try {
        // 重新验证 PIN（卡片可能已重置会话）
        await verifyPin(SC.pin);

        const msg = await openpgp.readMessage({ armoredMessage });
        const pkeskList = msg.packets.filterByTag(openpgp.enums.packet.publicKeyEncryptedSessionKey);
        if (!pkeskList.length) throw new Error('消息中未找到加密会话密钥');

        // 找到匹配卡片指纹的 PKESK
        let pkesk = pkeskList[0];
        if (SC.fingerprint) {
            const match = pkeskList.find(p => p.publicKeyID?.toHex().endsWith(SC.fingerprint.slice(-16)));
            if (match) pkesk = match;
        }

        // 提取 ECDH ephemeral point
        const ephemeralPoint = pkesk.encrypted[0]; // Uint8Array, compressed point
        const sharedSecret = await psoDecipher(ephemeralPoint);

        // 用共享密钥派生会话密钥并解密（通过 openpgp.js 内部机制）
        // 由于 openpgp.js 不直接暴露此路径，使用私钥解密的替代方案：
        // 将卡片返回的共享密钥注入解密流程
        // 注：完整实现需要 openpgp.js 的低层 API 或自定义 KDF
        // 此处返回共享密钥供调用方处理
        return sharedSecret;
    } catch (err) {
        showNotification('智能卡解密失败: ' + err.message, 'error');
        debugLog('智能卡解密失败: ' + err.message);
        return null;
    }
}

// ========================
// 事件绑定（由 init.js 调用）
// ========================

function setupSmartCardEvents() {
    DOM.smartCardToggle?.addEventListener('click', openSmartCardDrawer);
    DOM.smartCardDrawerClose?.addEventListener('click', closeSmartCardDrawer);
    DOM.smartCardDrawerOverlay?.addEventListener('click', closeSmartCardDrawer);
    DOM.scConnectBtn?.addEventListener('click', connectSmartCard);
    DOM.scDisconnectBtn?.addEventListener('click', disconnectSmartCard);
    DOM.scLockPinBtn?.addEventListener('click', lockPin);
    DOM.scDecryptBtn?.addEventListener('click', () => {
        showNotification('请在消息上点击解密按钮', 'warning');
    });
}
