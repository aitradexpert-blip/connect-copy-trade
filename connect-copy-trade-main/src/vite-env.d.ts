/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAKE_SIGNAL_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
