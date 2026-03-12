import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface LiquidationZone {
    priceLevel: number;
    longLiquidations: number;
    shortLiquidations: number;
    intensity: bigint;
}
export interface SmcSignal {
    priceLevel: number;
    direction: string;
    description: string;
    strength: bigint;
    symbol: string;
    signalType: string;
}
export interface AISignal {
    direction: string;
    takeProfit: number;
    reasoning: string;
    stopLoss: number;
    entryPrice: number;
    confidence: bigint;
    riskLevel: string;
    symbol: string;
}
export interface MarketAsset {
    change24h: number;
    name: string;
    volume: number;
    low24h: number;
    high24h: number;
    price: number;
    symbol: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface Gainer {
    name: string;
    price: number;
    changePercent: number;
    symbol: string;
}
export interface PerformanceStats {
    bestTrade: number;
    worstTrade: number;
    totalTrades: bigint;
    avgLoss: number;
    totalPnl: number;
    winRate: number;
    avgWin: number;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Candle {
    low: number;
    high: number;
    close: number;
    open: number;
    volume: number;
    timestamp: bigint;
}
export interface TradeRecord {
    id: bigint;
    pnl: number;
    direction: string;
    pnlPercent: number;
    timestamp: bigint;
    entryPrice: number;
    exitPrice: number;
    outcome: string;
    symbol: string;
}
export interface UserProfile {
    name: string;
    subscriptionTier: string;
    email: string;
}
export interface MarketSentiment {
    sentiment: string;
    fearGreedLabel: string;
    fearGreedIndex: bigint;
}
export interface GeminiAnalysis {
    marketBias: string;
    confidence: bigint;
    strategicInsight: string;
    signal: string;
    rawText: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    analyzeWithGemini(asset: string, price: number, high24h: number, low24h: number, rsi: number, volume: number): Promise<GeminiAnalysis>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAISignals(): Promise<Array<AISignal>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCandlestickData(_symbol: string, _timeframe: string): Promise<Array<Candle>>;
    getLiquidationData(_symbol: string): Promise<Array<LiquidationZone>>;
    getMarketData(): Promise<Array<MarketAsset>>;
    getMarketSentiment(): Promise<MarketSentiment>;
    getPerformanceStats(): Promise<PerformanceStats>;
    getSmcSignals(): Promise<Array<SmcSignal>>;
    getTopGainers(): Promise<Array<Gainer>>;
    getTopLosers(): Promise<Array<Gainer>>;
    getTradeHistory(): Promise<Array<TradeRecord>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    refreshMarketData(): Promise<Array<MarketAsset>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
