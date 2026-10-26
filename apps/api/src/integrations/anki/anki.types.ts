import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import type { ApiMethod } from '../../config/runtime.js';

export type AnkiRpc = (method: ApiMethod, params?: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
export type RequestTransport = (options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;
export interface NativeProfile { name: string }
export interface NativeCollection { profile: string; session: string }
export interface NativeDeck { id: string; name: string }
export interface NativeDescription { ankiVersion: string; apiMajor: 1 }
