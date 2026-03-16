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
export interface UserAccount {
    id: bigint;
    name: string;
    createdAt: bigint;
    role: string;
    email: string;
    isBanned: boolean;
    passwordHash: string;
    phone: string;
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
export interface AffiliateClick {
  exchange: string;
  assetSymbol: string;
  timestamp: bigint;
}

export interface GeminiAnalysis {
    rawText: string;
    strategicInsight: string;
    signal: string;
    confidence: bigint;
    marketBias: string;
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
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    analyzeWithGemini(marketData: string): Promise<string>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    banUser(userId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAISignals(): Promise<Array<AISignal>>;
    getActiveSessions(): Promise<bigint>;
    getAllUsers(): Promise<Array<UserAccount>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCandlestickData(_symbol: string, _timeframe: string): Promise<Array<Candle>>;
    getLiquidationData(_symbol: string): Promise<Array<LiquidationZone>>;
    getMarketData(): Promise<Array<MarketAsset>>;
    getMarketSentiment(): Promise<MarketSentiment>;
    getPerformanceStats(): Promise<PerformanceStats>;
    getSentimentFromNews(headlines: Array<string>): Promise<GeminiAnalysis>;
    getSmcSignals(): Promise<Array<SmcSignal>>;
    getTopGainers(): Promise<Array<Gainer>>;
    getTopLosers(): Promise<Array<Gainer>>;
    getTradeHistory(): Promise<Array<TradeRecord>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    loginWithEmail(email: string, passwordHash: string): Promise<{
        __kind__: "ok";
        ok: {
            token: string;
            name: string;
            role: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    logoutSession(token: string): Promise<void>;
    refreshMarketData(): Promise<Array<MarketAsset>>;
    registerUser(name: string, email: string, phone: string, passwordHash: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    requestOTP(phone: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    researchWithGemini(symbol: string, marketType: string): Promise<string>;
    resetPasswordWithOTP(phone: string, otp: string, newPassword: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    validateSession(token: string): Promise<{
        __kind__: "ok";
        ok: {
            userId: bigint;
            name: string;
            role: string;
            email: string;
            phone: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    trackAffiliateClick(exchange: string, assetSymbol: string): Promise<void>;
    getAffiliateClicks(): Promise<Array<AffiliateClick>>;
    verifyOTP(phone: string, otp: string): Promise<{
        __kind__: "ok";
        ok: {
            token: string;
            name: string;
            role: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
}
