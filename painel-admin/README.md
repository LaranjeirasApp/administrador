# Painel Administrativo — Laranjeiras

Painel web independente para gestão do sistema de filas das quadras de tênis.  
Roda sobre o mesmo Firebase (`controlequadras-95e02`) do app do morador/fiscal — sem banco de dados duplicado.

---

## Estrutura de arquivos

```
painel-admin/
├── index.html          # Shell SPA (tela de login + app)
├── style.css           # Design system completo (tokens, dark mode, componentes)
├── firebase-config.js  # Config pública do Firebase (APP_NAME = "painel-admin-v2")
├── auth.js             # Login/logout, persistência, verificação admins/{uid}
├── router.js           # Roteador hash-based (#dashboard, #historico, …)
├── app.js              # Ponto de entrada: Firebase, auth, router, tema e conexão
├── ui.js               # Componentes visuais compartilhados (ícones, quadras, diálogos)
├── utils.js            # Funções puras testáveis (sem Firebase/DOM)
├── escritas.js         # Monta as gravações (pessoas, aprovação, auditoria)
├── tests/
│   ├── test-utils.mjs     # Testes de datas, filtros e estatísticas
│   └── test-escritas.mjs  # Testes das gravações (formato igual ao app/fiscal)
└── pages/
    ├── dashboard.js    # Visão geral ao vivo (quadras, fila, partidas hoje)
    ├── fila.js         # Monitoramento da fila em tempo real (read-only)
    ├── historico.js    # Histórico de partidas + filtros + exportação Excel
    ├── estatisticas.js # Gráficos por período (Chart.js lazy-loaded)
    ├── configuracoes.js# Toggles, limite diário, quadras ativas, GPS
    ├── solicitacoes.js # Aprovar/recusar pedidos de cadastro
    ├── unidades.js     # Gestão de unidades, moradores e convites
    └── auditoria.js    # Log de ações + exportação CSV
```

---

## Pré-requisitos

- Node.js 18+ (só para rodar os testes de utils)
- Acesso admin no Firebase Console de `controlequadras-95e02`
- Uma conta de admin criada: veja "Criar conta admin" abaixo

Não há build. Todos os arquivos são módulos ES6 (`type="module"`) servidos direto.

---

## Execução local

Qualquer servidor HTTP estático funciona. Os mais simples:

```bash
# Com Node.js
npx serve painel-admin

# Com Python
python -m http.server 8080 --directory painel-admin

# Com VS Code: instale Live Server e clique em "Go Live"
```

Abra `http://localhost:5000` (ou a porta que o servidor informar).

> **Nota:** mesmo em `localhost`, o painel conecta ao Firebase de produção  
> (`controlequadras-95e02`). Os dados e as alterações são os reais.

O tema claro é o padrão. A escolha entre Claro e Escuro (barra superior) fica  
salva no navegador.

---

## Rodar os testes de utils

```bash
node painel-admin/tests/test-utils.mjs
node painel-admin/tests/test-escritas.mjs
```

Os dois devem terminar com `0 falhou`. Não requerem Firebase nem navegador.

---

## Criar conta admin

O painel usa autenticação Firebase com email no formato `{usuario}@admin.local`.  
**Essa conta não existe no app do morador** — é separada pelo domínio.

### Passo 1 — Criar o usuário no Firebase Auth

1. Acesse o [Firebase Console](https://console.firebase.google.com) → projeto `controlequadras-95e02`
2. Authentication → Users → Add user
3. Email: `fiscal@admin.local` (ou outro nome)  
   Senha: escolha uma senha forte
4. Copie o **UID** gerado (ex: `abc123xyz...`)

### Passo 2 — Adicionar ao nó `admins` no Realtime Database

No Firebase Console → Realtime Database → (ícone +) adicione:

```
admins/
  {UID_copiado}: true
```

Pronto. Login com `fiscal` + a senha definida no passo 1.

> O painel verifica `admins/{uid}` no banco a cada login. Autenticado mas  
> não listado em `admins/` = acesso negado (logout automático).

---

## Publicar online (Firebase Hosting)

O sistema é publicado pelo **Firebase Hosting**, no mesmo lugar do app do  
morador e do painel do fiscal. O GitHub guarda só o código, não publica nada.

Na pasta raiz do projeto:

```bash
firebase deploy --only hosting
```

Use sempre `--only hosting`: sem isso o comando também publicaria as regras do  
banco e as Cloud Functions. A configuração (`firebase.json`) envia a pasta do  
projeto inteira, menos `teste/`, `functions/`, arquivos `.md` e ocultos — então  
o app do morador e o painel do fiscal vão junto, como estiverem no computador.

O painel fica em:

```
https://laranjeiras.web.app/painel-admin/
https://controlequadras-95e02.web.app/painel-admin/
```

(com a barra no final). O roteamento é por `#` (`#dashboard`), sem configuração extra.

## Guardar no GitHub

```bash
git add painel-admin
git commit -m "descrição da mudança"
git push -u origin feature/painel-admin
```

`git add painel-admin` pega só esta pasta. A conta com permissão de escrita no  
repositório é `LaranjeirasApp`.

---

## Segurança

- **Chaves públicas:** o `firebase-config.js` contém apenas as chaves  
  públicas do SDK (seguro colocar no repositório, conforme documentação oficial do Firebase).
- **Chaves privadas:** nunca incluídas aqui. Se precisar de operações admin  
  (criar usuários em massa, etc.), use Cloud Functions ou o Admin SDK local.
- **Controle de acesso:** as Security Rules do Realtime Database restringem  
  leitura/escrita de `admins/`, `auditoria/` e outros nós sensíveis  
  a usuários com `admins/{uid} == true`.
- **Sessão isolada:** o app usa `initializeApp(config, "painel-admin-v2")`,  
  nomeando a instância Firebase para não interferir na sessão do app do morador.

---

## Ambiente de teste vs. produção

O projeto mantém dois ambientes:

| Ambiente | Firebase project | Pasta |
|---|---|---|
| Produção | `controlequadras-95e02` | `painel-admin/` (este) |
| Teste | `laranjeiras-teste-2026` | `teste/admin/` |

Este `painel-admin/` aponta **sempre para produção**.  
Para testar features novas, use a pasta `teste/` com `--project laranjeiras-teste-2026`.

---

## Dependências externas

Carregadas via CDN, sem npm install:

| Biblioteca | Versão | Uso |
|---|---|---|
| Firebase SDK | 10.8.0 | Auth + Realtime Database |
| xlsx-js-style | 1.2.0 | Exportação Excel (histórico) |
| Chart.js | 4.4.1 | Gráficos (estatísticas) — lazy-loaded |

Fontes Google: Inter (corpo) + Sora (títulos) + IBM Plex Mono (código).
