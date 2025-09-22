# rbmonitor

## Configuração de variáveis de ambiente

Agora o projeto suporta variáveis de ambiente via arquivo `.env` (use o `.env.example` como base). As principais variáveis são:

- `ROBLOSECURITY`: Cole seu cookie de sessão Roblox.
- `USER_ID`: ID do usuário Roblox a ser monitorado.
- `ALLOW_SELF_SIGNED`: Use `1` para ignorar certificados SSL autoassinados (útil para ambientes de teste).

Exemplo de uso:

```bash
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

Se receber erro de certificado SSL, defina `ALLOW_SELF_SIGNED=1` no `.env`.

## Monitoramento de múltiplos usuários

Agora é possível monitorar vários usuários ao mesmo tempo usando a variável `USERS_IDS` no `.env`:

Exemplo:

```
USERS_IDS='["7738147772","8631412913","9005903775","8419659295","2616521101"]'
```

Se `USERS_IDS` não for definido, será usado `USER_ID` (para compatibilidade).

O histórico agora armazena um array `players` com o status de cada usuário monitorado.
