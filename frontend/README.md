# ColdSense — Frontend

Dashboard de monitoramento de refrigeração com React, TypeScript, Vite e Supabase.

## Executar

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do seu projeto Supabase. Um arquivo `.env` existente também é aceito pelo Vite.
3. Execute `npm run dev`.

Use somente a chave publicável (ou a chave legada `anon`) no frontend. A chave `service_role` é exclusiva do backend.

## Login

- O acesso usa e-mail e senha de um usuário existente no Supabase Auth. Crie os usuários pelo painel do Supabase em **Authentication → Users → Add user**, com o e-mail confirmado.
- Não há cadastro público. No projeto Supabase hospedado, desative **Allow new users to sign up** nas configurações de Authentication. O `supabase/config.toml` já desativa o cadastro no ambiente local.
- Visitantes sem sessão são direcionados para `/login` antes de qualquer consulta do dashboard. `/` e `/freezer-ai` exigem autenticação.
- Após o login, o usuário volta à página que tentou acessar. A sessão é persistida e renovada pelo Supabase; ao sair, o cache de dados é limpo e as páginas protegidas voltam a exigir login.
- Usuários autenticados que acessam `/login` são direcionados ao dashboard.

A proteção das rotas controla a interface. Para restringir também consultas diretas ao banco, habilite RLS nas tabelas e permita leitura apenas ao papel `authenticated`. As políticas do projeto Supabase hospedado são administradas separadamente deste frontend.

## Tema visual

A paleta do login é o tema global do Tailwind, definido em `src/index.css` com `@theme`. Use as cores semânticas `secondary` (azul escuro), `accent` (menta), `primary` (azul), `surface`, `heading`, `body`, `muted` e `border` nos componentes.

A tela de login usa somente classes utilitárias do Tailwind, incluindo os estados de foco, carregamento e erro. A variante `compact:` adapta o layout a telas de desktop com pouca altura.

## Verificação

Execute `npm run build` para verificar os tipos e gerar a versão de produção.
