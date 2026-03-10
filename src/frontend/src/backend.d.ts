import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface MarketAsset {
    change24h: number;
    name: string;
    volume: number;
    low24h: number;
    high24h: number;
    price: number;
    symbol: string;
}
export interface Signal {
    id: bigint;
    symbol: string;
    direction: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    confidence: bigint;
    outcome: string;
    timestamp: bigint;
    lockedUntil: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserRole(): Promise<UserRole>;
    isCallerAdmin(): Promise<boolean>;
    getMarketData(): Promise<Array<MarketAsset>>;
    saveSignal(symbol: string, direction: string, entryPrice: number, stopLoss: number, takeProfit1: number, takeProfit2: number, confidence: bigint, lockedUntil: bigint): Promise<bigint>;
    getSignalHistory(): Promise<Array<Signal>>;
    updateSignalOutcome(id: bigint, outcome: string): Promise<void>;
    getWinRate(): Promise<number>;
}
