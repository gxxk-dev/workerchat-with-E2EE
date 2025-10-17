// ========================
// 密钥管理函数
// ========================

// 获取Long Key ID(使用完整指纹)
function getLongKeyId(pubKey) {
    return pubKey.getFingerprint();
}

// 初始化密钥指纹(只执行一次)
function initializeMyKeyId(pubKey) {
    if (hasInitializedKeyId) {
        debugLog('密钥指纹已初始化,跳过重复加载');
        return false;
    }

    userFingerprint = getLongKeyId(pubKey);
    userName = pubKey.users[0]?.userID?.name || '匿名';
    userEmail = pubKey.users[0]?.userID?.email || '';
    keyIdEl.textContent = userFingerprint;
    hasInitializedKeyId = true;

    debugLog(`密钥指纹已初始化(Long Key ID): ${userFingerprint}`);
    return true;
}

// 加载本地密钥
async function loadLocalKeys() {
    try {
        privateKey = localStorage.getItem('pgpPrivateKey') || '';
        publicKey = localStorage.getItem('pgpPublicKey') || '';

        if (publicKey) {
            debugLog('正在解析本地公钥...');
            const pubKey = await openpgp.readKey({ armoredKey: publicKey });

            // 使用统一函数初始化密钥ID
            if (initializeMyKeyId(pubKey)) {
                debugLog('本地密钥加载成功');
            }
        }
    } catch (error) {
        debugLog('公钥解析失败: ' + error.message);
        showNotification('本地密钥解析失败: ' + error.message, 'error');
    }
}

// 导入密钥
async function importKey(type) {
    return new Promise((resolve) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.asc,.pgp,.txt';

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve();
                return;
            }

            try {
                debugLog(`开始导入${type}密钥文件: ${file.name}`);
                let text = await file.text();

                if (type === 'public') {
                    const pubKey = await openpgp.readKey({ armoredKey: text });
                    if (pubKey.isPrivate()) {
                        throw new Error('这不是一个有效的公钥');
                    }

                    publicKey = text;
                    localStorage.setItem('pgpPublicKey', publicKey);

                    // 使用统一函数初始化密钥指纹
                    initializeMyKeyId(pubKey);
                    showNotification('公钥导入成功');
                    debugLog('公钥导入成功,密钥指纹: ' + userFingerprint);

                    // 重新注册
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                        registerUser();
                    }

                } else if (type === 'private') {
                    const privKey = await openpgp.readPrivateKey({ armoredKey: text });
                    if (!privKey.isPrivate()) {
                        throw new Error('这不是一个有效的私钥');
                    }

                    privateKey = text;
                    localStorage.setItem('pgpPrivateKey', privateKey);

                    // 如果还没有公钥,从私钥中提取
                    if (!publicKey) {
                        const pubKeyFromPriv = privKey.toPublic();
                        publicKey = pubKeyFromPriv.armor();
                        localStorage.setItem('pgpPublicKey', publicKey);

                        // 使用统一函数初始化密钥ID
                        initializeMyKeyId(pubKeyFromPriv);

                        // 重新注册
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                            registerUser();
                        }
                    }

                    showNotification('私钥导入成功');
                    debugLog('私钥导入成功');
                }

            } catch (error) {
                debugLog(`${type}密钥导入失败: ` + error.message);
                showNotification(`${type}密钥导入失败: ` + error.message, 'error');
            }

            resolve();
        };

        fileInput.click();
    });
}

// 复制公钥
async function copyPublicKey() {
    if (!publicKey) {
        showNotification('没有可复制的公钥', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(publicKey);
        showNotification('公钥已复制到剪贴板');
    } catch (error) {
        // fallback方法
        const textArea = document.createElement('textarea');
        textArea.value = publicKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('公钥已复制到剪贴板');
    }
}

// 生成新密钥
async function generateNewKeys() {
    const generate6DigitNumber = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };
    try {
        debugLog('开始生成新密钥对...');
        showNotification('正在生成密钥，请稍候...', 'warning');

        // 生成密钥对
        const { privateKey: privKey, publicKey: pubKey } = await openpgp.generateKey({
            type: 'ecc',
            curve: 'curve25519',
            userIDs: [{
                name: prompt('请输入您的名字') || `User${generate6DigitNumber()}`, // 这里如果留空的话openpgp会自动生成一对 似乎不是未定义行为（？
                email: prompt('请输入您的邮箱')
            }],
            passphrase: ''
        });

        debugLog('密钥对生成完成');

        // 保存密钥
        privateKey = privKey;
        publicKey = pubKey;
        localStorage.setItem('pgpPrivateKey', privateKey);
        localStorage.setItem('pgpPublicKey', publicKey);
        debugLog('密钥已保存到本地存储');

        // 提取用户信息并使用统一函数初始化密钥指纹
        const pubKeyObj = await openpgp.readKey({ armoredKey: publicKey });
        initializeMyKeyId(pubKeyObj);
        debugLog('密钥生成成功,密钥指纹: ' + userFingerprint);

        showNotification('新密钥已生成,即将刷新页面...');

        // 延迟1秒后刷新页面,让用户看到成功提示
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        debugLog('生成密钥失败: ' + error.message);
        showNotification('生成密钥失败: ' + error.message, 'error');
    }
}
