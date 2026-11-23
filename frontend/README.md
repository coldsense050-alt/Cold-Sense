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
- Visitantes sem sessão são direcionados para `/login` antes de qualquer consulta do dashboard. `/`, `/freezers`, `/freezers/:freezerId`, `/freezer-ai` e `/prestadores` exigem autenticação.
- Após o login, o usuário volta à página que tentou acessar, preservando os parâmetros de busca e a âncora. O retorno aceita caminhos internos, sem uma lista de páginas permitidas, e usa `/` para destinos inválidos, externos ou para o próprio login. Novas rotas protegidas não exigem mudanças no login. A sessão é persistida e renovada pelo Supabase; ao sair, o cache de dados é limpo e as páginas protegidas voltam a exigir login.
- Usuários autenticados que acessam `/login` são direcionados ao dashboard.

A proteção das rotas controla a interface. Para restringir também consultas diretas ao banco, habilite RLS nas tabelas e permita leitura apenas ao papel `authenticated`. As políticas do projeto Supabase hospedado são administradas separadamente deste frontend.

## Tema visual

A paleta do login é o tema global do Tailwind, definido em `src/index.css` com `@theme`. Use as cores semânticas `secondary` (azul escuro), `accent` (menta), `primary` (azul), `surface`, `heading`, `body`, `muted` e `border` nos componentes.

A tela de login usa somente classes utilitárias do Tailwind, incluindo os estados de foco, carregamento e erro. A variante `compact:` adapta o layout a telas de desktop com pouca altura.

## Prestadores de manutenção

A página `/prestadores` exige login e permite pesquisar por nome, e-mail ou telefone, filtrar por freezer, cadastrar, editar e excluir prestadores. Cada prestador pode atender vários freezers, e um freezer pode ter vários prestadores.

O banco deve conter as tabelas `prestadores_manutencao` e `freezers_prestadores` do SQL de cadastro, com as chaves estrangeiras para `freezers`, exclusão dos vínculos em cascata e as políticas RLS para usuários autenticados. Não é necessária uma função SQL adicional.

O hook `src/features/prestadores/hooks/useSavePrestador.ts` gerencia a mutation e atualiza o cache ao terminar. Ele delega o salvamento à função `savePrestador` de `src/services/prestadorService.ts`, que concentra as chamadas ao Supabase, sincronização dos vínculos e recuperação de falhas. Como são requisições separadas, o service tenta desfazer o cadastro ou restaurar os dados anteriores se a gravação dos vínculos falhar. Essa recuperação não substitui uma transação do banco.

A tabela está em `src/features/prestadores/components/PrestadoresTable.tsx`, o formulário compartilhado de criação e edição em `src/features/prestadores/components/PrestadorFormModal.tsx`, e a estrutura reutilizável de modal em `src/components/ui/Modal.tsx`.

## Freezers

A página `/freezers` lista os equipamentos em cards, permite buscar por nome ou número e cadastrar um freezer pelo botão **Adicionar freezer**. O formulário grava o nome na tabela `freezers` e atualiza a listagem e os seletores que usam o mesmo cache. O cadastro requer uma política RLS de inserção para usuários autorizados, além da leitura dos registros inseridos.

Cada card abre `/freezers/:freezerId`, com o status de conexão, última temperatura, média, mínima, máxima, gráfico e leituras paginadas. As métricas e o histórico podem ser filtrados pelas últimas 24 horas, pelos últimos 7 dias ou por todo o histórico. O status segue os intervalos do dashboard: ativo até 10 minutos sem leitura, instável até 15 minutos e offline após esse intervalo. As leituras são consultadas novamente a cada minuto enquanto a página está aberta.

O gráfico mostra as últimas 240 leituras do período; as métricas e a tabela consideram todas as leituras disponíveis no período. A integração usa somente os campos existentes `freezers(id, nome)` e `temperaturas(id, freezer_id, temperatura, coletado_em)`.

Os cards consultam a última leitura de cada equipamento individualmente. A página de detalhes carrega o histórico em lotes para respeitar o limite de registros por resposta do Supabase.

## Verificação

Execute `npm run build` para verificar os tipos e gerar a versão de produção.
