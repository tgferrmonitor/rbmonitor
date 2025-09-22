// Requer as dependências. É necessário instalar o 'axios'.
// npm install axios
import axios from 'axios';
import crypto from 'crypto';

/**
 * Realiza o login na plataforma Roblox e retorna o token .ROBLOSECURITY.
 * @param {string} username - O nome de usuário da conta.
 * @param {string} password - A senha da conta.
 * @returns {Promise<string|null>} O cookie .ROBLOSECURITY ou null em caso de falha.
 */
async function login(username, password) {
    // Cria uma instância do axios para gerenciar cookies e o x-csrf-token automaticamente.
    const session = axios.create({
        // Headers que serão enviados em todas as requisições
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
            'accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json;charset=UTF-8',
            'Origin': 'https://www.roblox.com',
            'Pragma': 'no-cache',
            'Referer': 'https://www.roblox.com/',
            'Sec-Ch-Ua': '"Google Chrome";v="93", " Not;A Brand";v="99", "Chromium";v="93"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
        },
        // Configuração para gerenciar cookies.
        withCredentials: true,
    });

    // 1. Obter o x-csrf-token
    // O token é necessário para a maioria das requisições POST na Roblox.
    // Uma tentativa de login (mesmo que falhe) retorna o token no header.
    let csrfToken;
    try {
        console.log('Obtendo x-csrf-token...');
        const csrfResponse = await session.post('https://auth.roblox.com/v2/login');
        // O axios lança um erro para status 4xx, então pegamos o token no catch.
    } catch (error) {
        csrfToken = error.response.headers['x-csrf-token'];
        if (!csrfToken) {
            console.error('Falha ao obter o x-csrf-token.');
            return null;
        }
        console.log('x-csrf-token obtido com sucesso!');
        session.defaults.headers.common['x-csrf-token'] = csrfToken;
    }


    // 2. Obter o serverNonce
    let serverNonce;
    try {
        console.log('Obtendo serverNonce...');
        const nonceResponse = await session.get('https://apis.roblox.com/hba-service/v1/getServerNonce');
        serverNonce = nonceResponse.data.serverNonce;
        console.log('serverNonce obtido com sucesso!');
    } catch (error) {
        console.error('Falha ao obter o serverNonce:', error.response ? error.response.data : error.message);
        return null;
    }

    // 3. Operações de Criptografia
    console.log('Gerando chaves e assinatura...');
    // Gera um par de chaves ECDH (Elliptic Curve Diffie-Hellman) usando a curva P-256.
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();

    // Obtém a chave pública no formato raw (não comprimido) e converte para base64.
    const clientPublicKey = ecdh.getPublicKey('base64');

    // Cria a assinatura (saiSignature).
    // A assinatura é um HMAC-SHA256 da chave pública do cliente e do serverNonce.
    const hmac = crypto.createHmac('sha256', ecdh.getPrivateKey());
    hmac.update(Buffer.from(clientPublicKey + serverNonce, 'base64'));
    const saiSignature = hmac.digest('base64');
    console.log('Chaves e assinatura geradas com sucesso!');


    // 4. Enviar a requisição de login
    try {
        console.log('Enviando requisição de login...');
        const loginPayload = {
            ctype: 'Username',
            cvalue: username,
            password: password,
            secureAuthenticationIntent: {
                clientPublicKey: clientPublicKey,
                clientEpochTimestamp: Date.now(),
                serverNonce: serverNonce,
                saiSignature: saiSignature,
            },
        };

        const loginResponse = await session.post('https://auth.roblox.com/v2/login', loginPayload);
        
        // 5. Extrair o cookie .ROBLOSECURITY
        const cookies = loginResponse.headers['set-cookie'];
        const robloSecurityCookie = cookies.find(cookie => cookie.includes('.ROBLOSECURITY'));

        if (robloSecurityCookie) {
            const token = robloSecurityCookie.match(/\.ROBLOSECURITY=([^;]+)/)[1];
            console.log('Login bem-sucedido!');
            return token;
        } else {
            console.error('Não foi possível encontrar o cookie .ROBLOSECURITY na resposta.');
            return null;
        }

    } catch (error) {
        console.error('Erro durante o login:', error.response ? error.response.data : error.message);
        // Se o erro for de "TwoStepVerification", você precisará lidar com isso.
        if (error.response && error.response.data && error.response.data.errors) {
            const twoStepError = error.response.data.errors.find(e => e.code === 10);
            if (twoStepError) {
                console.error('Erro: A verificação de duas etapas está ativada. Esta implementação não lida com 2FA.');
            }
        }
        return null;
    }
}


const USERNAME = 'paimeureipai';
const PASSWORD = 'Ttiago1988!';

if (USERNAME !== 'paimeureipai' || PASSWORD !== 'Ttiago1988!') {
    console.warn("Por favor, substitua 'paimeureipai' e 'Ttiago1988!' com suas credenciais no arquivo login.js");
} else {
    login(USERNAME, PASSWORD).then(token => {
        if (token) {
            console.log('\n--- Token .ROBLOSECURITY ---');
            console.log(token);
            console.log('\nUse este token para fazer requisições autenticadas.');
        } else {
            console.log('\nFalha no processo de login.');
        }
    });
}