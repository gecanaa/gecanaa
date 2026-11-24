# SGE Canaã 52

Sistema do Grupo Escoteiro Canaã 52/DF, reescrito do zero. O site é estático
(React + Vite), hospedado no GitHub Pages, e conversa com um Apps Script novo
publicado como Web App. **A planilha continua sendo o banco de dados** — nada
foi migrado para outro lugar.

Hoje o sistema tem **chamada**, **fichas dos integrantes**, **relatório de
presença** e **fichas em PDF**. Financeiro, progressão, almoxarifado, lojinha e
lanches entram depois, sobre a mesma base.

- Login com conta Google, liberado pela aba `Usuarios` da planilha. Depois de
  entrar, o chefe fica 30 dias sem precisar entrar de novo.
- O app é instalável no celular (PWA), com o brasão do grupo como ícone.
- Na chamada, quem é tocado fica presente e quem fica em branco conta como
  falta. A justificativa de falta é opcional e liga em *Conta → Chamada*
  (só administrador).
- O zoom fica travado no app, para um toque na chamada nunca virar zoom sem
  querer, e é liberado no relatório e na tela de impressão.
- **A chamada funciona sem internet.** Os integrantes ficam guardados no
  aparelho e a chamada salva offline entra numa fila, enviada sozinha quando a
  conexão volta (ou na próxima vez que o app abrir).
- Toda gravação é registrada na aba `Logs`.

## Como ligar tudo (uma vez)

### 1. Apps Script novo

Crie um projeto **novo e separado** em <https://script.google.com> (não use o
script antigo preso à planilha — assim ele continua existindo como plano B).

1. Apague o `Código.gs` de exemplo e cole o conteúdo de `apps-script/Codigo.gs`.
2. Em **Configurações do projeto**, marque *Mostrar o arquivo de manifesto
   appsscript.json* e substitua o conteúdo pelo de `apps-script/appsscript.json`.
3. Ainda em Configurações, crie as **propriedades do script**:

   | Propriedade | Valor |
   |---|---|
   | `SHEET_ID` | `1yt6FCddSFywM37Jc8r31agcfmQ2JtDiUIA_oE5uctPI` |
   | `GOOGLE_CLIENT_ID` | o ID do cliente OAuth do passo 2 |
   | `ADMIN_BOOTSTRAP` | seu e-mail, para o primeiro acesso |

4. **Implantar → Nova implantação → App da Web**, executando *como eu* e com
   acesso para *qualquer pessoa*. Guarde a URL que termina em `/exec`.

Sempre que mudar o código, use **Gerenciar implantações → editar → Nova versão**.
Criar uma implantação nova gera outra URL.

Quando o código pedir permissões novas (foi o caso do envio de fotos, que usa o
Drive), rode a função `autorizar` uma vez pelo editor antes de reimplantar: o
Google mostra a tela de autorização e, a partir daí, o Web App funciona.

### 2. Cliente OAuth do Google

Em <https://console.cloud.google.com> → *APIs e serviços* → *Credenciais* →
**Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.

Em *Origens JavaScript autorizadas*, inclua:

```
https://SEU-USUARIO.github.io
http://localhost:5173
```

Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).

### 3. Liberar os chefes

Na aba `Usuarios` da planilha, preencha a coluna **EMAIL** com a conta Google de
cada chefe e ajuste **NIVEL DE ACESSO** (`admin` ou `geral`). Quem não estiver
ali não entra. Enquanto nenhum e-mail estiver preenchido, só o `ADMIN_BOOTSTRAP`
consegue acessar.

A coluna `SENHA` deixa de ser usada — apague o conteúdo dela depois da virada,
já que hoje guarda senha em texto plano.

### 4. GitHub Pages

1. Crie o repositório e envie este projeto.
2. Em **Settings → Pages**, escolha *Source: GitHub Actions*.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_API_URL` — a URL `/exec` do passo 1
   - `VITE_GOOGLE_CLIENT_ID` — o ID do passo 2
4. Faça um push na `main`. O site sai em
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Os dois valores ficam visíveis no JavaScript do site, e tudo bem: quem decide
quem entra é o Apps Script, conferindo o login com o Google e a lista da aba
`Usuarios`.

## Rodando na sua máquina

```bash
npm install
cp .env.example .env   # preencha os dois valores
npm run dev
```

## O que mudou em relação ao sistema antigo

- **Presenças passam a guardar o ID do integrante**, não só o nome. A coluna
  `ID Integrante` é criada automaticamente na aba `Presencas` no primeiro salvamento.
- **Salvar a chamada duas vezes não duplica**: o sistema substitui os registros
  daquele dia e ramo.
- **Senha sai do jogo**: o acesso é pela conta Google.
- Em *Conta → Conferência dos dados* (só admin) há um relatório que aponta nomes
  repetidos, chamadas duplicadas, registro UEB vencido e fichas sem ramo. Ele só
  lê a planilha.

As preferências do grupo (hoje só a justificativa de falta) ficam nas
propriedades do script, não na planilha. A sessão longa é assinada com a
propriedade `SESSAO_SEGREDO`, criada sozinha no primeiro login — apagá-la
desconecta todo mundo, o que serve de botão de emergência.

Dois problemas já conhecidos nos dados de hoje, para corrigir na planilha:
a ficha de *Alice Morais de Lima* tem `Alergia = Ativo`, e a aba `Presencas` tem
o mesmo jovem registrado como "Adrian" e "Adrian Teles de Oliveira" no dia
28/02/2026.
