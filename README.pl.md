# Simply Connect dla Node.js i NestJS

Oficjalna integracja TypeScript z publicznym API Simply Connect. Repozytorium zawiera dwie paczki:

- `@simply-connect/node` — lekki klient Node.js bez zależności uruchomieniowych;
- `@simply-connect/nestjs` — moduł DI dla NestJS i opcjonalny panel developerski.

Obie paczki dostarczają ESM, CommonJS i typy TypeScript. Testowane są Node.js 22.12+, 24 i 26 oraz NestJS 10, 11 i 12.

Pełna instrukcja instalacji, zakresy klucza i przykłady znajdują się w angielskim [README](README.md), a ludzka
instrukcja krok po kroku jest publikowana na stronie
[Simply Connect — Node.js i NestJS](https://simply-connect.ovh/integrations/node-nestjs).

Lokalny przykład uruchamia własne mock API, więc nie wysyła prawdziwego SMS-a ani nie wykonuje połączenia:

```bash
npm install
npm run build
npm run start --workspace simply-connect-nestjs-demo
```

Panel będzie dostępny pod `http://127.0.0.1:38086/simply-connect`, a hasło demonstracyjne to
`simply-connect-demo`.
