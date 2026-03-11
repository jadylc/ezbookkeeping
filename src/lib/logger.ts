import { isEnableDebug } from './settings.ts';

function logDebug(msg: string, obj?: unknown): void {
    if (isEnableDebug()) {
        if (obj) {
            console.debug('[ezfinance Debug] ' + msg, obj);
        } else {
            console.debug('[ezfinance Debug] ' + msg);
        }
    }
}

function logInfo(msg: string, obj?: unknown): void {
    if (obj) {
        console.info('[ezfinance Info] ' + msg, obj);
    } else {
        console.info('[ezfinance Info] ' + msg);
    }
}

function logWarn(msg: string, obj?: unknown): void {
    if (obj) {
        console.warn('[ezfinance Warn] ' + msg, obj);
    } else {
        console.warn('[ezfinance Warn] ' + msg);
    }
}

function logError(msg: string, obj?: unknown): void {
    if (obj) {
        console.error('[ezfinance Error] ' + msg, obj);
    } else {
        console.error('[ezfinance Error] ' + msg);
    }
}

export default {
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError
};
