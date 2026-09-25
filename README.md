<div align="center">

# BaixaRI

Interface web para localizar protocolos e certidões nos formatos ZIP, PDF ou DOCX e converter arquivos locais em um PDF único diretamente no navegador.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0B1120)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

[Backend](https://github.com/marcosfrancomarinho/baixari-backend) · [Funcionalidades](#funcionalidades) · [Execução](#instalação-e-execução)

</div>

## Sobre o projeto

O **BaixaRI** simplifica a consulta e o download de documentos organizados por número. O usuário informa o número, escolhe entre **protocolo** e **certidão** e seleciona o formato desejado.

ZIP e PDF de protocolos/certidões são recebidos prontos da API. Para DOCX, o frontend acompanha a extração de cada página em tempo real e cria o Word no navegador.

Na aba **Converter para PDF**, arquivos PDF, JPG, JPEG e PNG são processados inteiramente no navegador. Eles não são enviados ao backend.

## Funcionalidades

- consulta por número de protocolo ou certidão;
- saída em ZIP, PDF ou DOCX;
- consumo progressivo de NDJSON para geração de DOCX;
- criação de Word no navegador com `docx`;
- seleção, reordenação e remoção de vários arquivos;
- união de PDFs no navegador com `pdf-lib`;
- conversão de JPG/JPEG/PNG para PDF;
- normalização de imagens com fundo branco, limite de 40 MP e lado máximo de 3000 px;
- progresso por arquivo e cancelamento com `AbortController`;
- nenhum upload ao servidor durante a conversão de arquivos locais;
- interface responsiva com Tailwind CSS.

## Fluxo

```mermaid
flowchart TD
    A["Consulta de protocolo/certidão"] --> B["API BaixaRI"]
    B --> C{"Formato"}
    C -->|ZIP ou PDF| D["Download direto"]
    C -->|DOCX| E["Texto via NDJSON"]
    E --> F["Word criado no navegador"]

    G["PDF/JPG/PNG local"] --> H["Conversão no navegador"]
    H --> I["pdf-lib"]
    I --> J["documentos.pdf"]
```

## Conversão local para PDF

A conversão não usa `VITE_API_URL` e não chama uma rota de upload.

1. O frontend identifica PDF, PNG ou JPEG pela assinatura do arquivo.
2. PDFs têm suas páginas copiadas para o documento final.
3. Imagens são redimensionadas quando necessário, recebem fundo branco e são convertidas para JPEG.
4. O `pdf-lib` monta o PDF respeitando a ordem escolhida.
5. O navegador inicia o download de `documentos.pdf`.

O limite de 40 milhões de pixels por imagem reduz o risco de consumo excessivo de memória. Como todo o trabalho acontece no dispositivo do usuário, arquivos muito grandes ainda dependem da memória disponível no navegador.

## Tecnologias

- **React 19**
- **TypeScript 6**
- **Vite 8**
- **Tailwind CSS 4**
- **docx**
- **pdf-lib**
- **Fetch API + Streams**
- **ESLint**

## Estrutura

```text
src/
├── componets/
│   ├── Alert.tsx
│   ├── ConvertForm.tsx
│   ├── DownloadForm.tsx
│   ├── Footer.tsx
│   └── Header.tsx
├── services/
│   └── pdf.converter.ts
├── styles/
│   └── index.css
├── App.tsx
└── main.tsx
```

## Configuração

Informe a URL do backend em `.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

Essa URL é usada somente nas consultas e na extração de texto de protocolos/certidões. A aba de conversão de arquivos locais funciona sem enviar os documentos ao backend.

## Instalação e execução

### Requisitos

- Node.js 22 ou superior;
- npm ou Yarn;
- BaixaRI Backend para as funcionalidades de consulta.

```bash
git clone https://github.com/marcosfrancomarinho/baixari.git
cd baixari
npm install
npm run dev
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | inicia o servidor de desenvolvimento |
| `npm run build` | verifica tipos e gera o build |
| `npm run lint` | executa o ESLint |
| `npm run preview` | visualiza o build |

## Autor

Desenvolvido por [Marcos Marinho](https://github.com/marcosfrancomarinho).
