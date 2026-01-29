/**
 * Mendix 전역 mx 객체 타입 선언
 */
declare global {
    interface Window {
        mx?: {
            data?: {
                commit: (options: 
                    | { mxobjs: any[]; callback?: () => void; error?: (error: any) => void } 
                    | { mxobj: any; callback?: () => void; error?: (error: any) => void }
                ) => void | Promise<void>;
                get?: (options: { guid: string; callback?: (obj: any) => void; error?: (error: any) => void }) => void;
            };
            window?: {
                confirm: (message: string, callback: (result: boolean) => void) => void;
                alert: (message: string, callback?: () => void) => void;
                prompt: (message: string, defaultValue?: string, callback?: (result: string | null) => void) => void;
            };
        };
    }
}

export {};
