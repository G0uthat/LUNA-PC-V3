/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*?url' {
  const src: string;
  export default src;
}

declare module 'mammoth/mammoth.browser' {
  export interface MammothImage {
    contentType: string;
    read(encoding?: 'base64'): Promise<string>;
  }

  export interface MammothConvertOptions {
    arrayBuffer: ArrayBuffer;
    convertImage?: unknown;
  }

  export interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  const mammoth: {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: { convertImage?: unknown }
    ): Promise<MammothResult>;
    images: {
      imgElement(
        handler: (image: MammothImage) => Promise<{ src: string }>
      ): unknown;
    };
  };

  export default mammoth;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

interface Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: { type?: string; message?: string }) => void;
        }) => GoogleTokenClient;
        revoke: (accessToken: string, done?: () => void) => void;
      };
    };
    picker?: {
      DocsView: new (viewId?: unknown) => {
        setIncludeFolders: (v: boolean) => unknown;
        setSelectFolderEnabled: (v: boolean) => unknown;
        setMimeTypes: (m: string) => unknown;
      };
      ViewId: { FOLDERS: unknown; DOCS: unknown };
      PickerBuilder: new () => {
        addView: (v: unknown) => unknown;
        setOAuthToken: (token: string) => unknown;
        setDeveloperKey: (key: string) => unknown;
        setAppId: (id: string) => unknown;
        setTitle: (t: string) => unknown;
        setCallback: (cb: (data: { action: string; docs?: Array<{ id: string; name: string }> }) => void) => unknown;
        build: () => { setVisible: (v: boolean) => void };
      };
      Action: { PICKED: string; CANCEL: string };
    };
  };
  gapi?: {
    load: (api: string, callback: () => void) => void;
  };
}

