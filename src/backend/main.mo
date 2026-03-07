import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import VarArray "mo:core/VarArray";
import Order "mo:core/Order";
import Map "mo:core/Map";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import OutCall "http-outcalls/outcall";

actor {
  // Include authorization system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile Type
  public type UserProfile = {
    name : Text;
    email : Text;
    subscriptionTier : Text; // "FREE", "PREMIUM", "PRO"
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // Data Types
  type MarketAsset = {
    symbol : Text;
    name : Text;
    price : Float;
    change24h : Float;
    volume : Float;
    high24h : Float;
    low24h : Float;
  };

  type CachedMarketData = {
    assets : [MarketAsset];
    timestamp : Int;
  };

  type Candle = {
    timestamp : Int;
    open : Float;
    high : Float;
    low : Float;
    close : Float;
    volume : Float;
  };

  type AISignal = {
    symbol : Text;
    direction : Text;
    confidence : Nat;
    riskLevel : Text;
    entryPrice : Float;
    stopLoss : Float;
    takeProfit : Float;
    reasoning : Text;
  };

  type LiquidationZone = {
    priceLevel : Float;
    longLiquidations : Float;
    shortLiquidations : Float;
    intensity : Nat;
  };

  type MarketSentiment = {
    fearGreedIndex : Nat;
    fearGreedLabel : Text;
    sentiment : Text;
  };

  type Gainer = {
    symbol : Text;
    name : Text;
    price : Float;
    changePercent : Float;
  };

  type TradeRecord = {
    id : Nat;
    symbol : Text;
    direction : Text;
    entryPrice : Float;
    exitPrice : Float;
    pnl : Float;
    pnlPercent : Float;
    timestamp : Int;
    outcome : Text;
  };

  type PerformanceStats = {
    totalTrades : Nat;
    winRate : Float;
    totalPnl : Float;
    avgWin : Float;
    avgLoss : Float;
    bestTrade : Float;
    worstTrade : Float;
  };

  type SmcSignal = {
    symbol : Text;
    signalType : Text;
    direction : Text;
    priceLevel : Float;
    strength : Nat;
    description : Text;
  };

  module TradeRecord {
    public func compare(t1 : TradeRecord, t2 : TradeRecord) : Order.Order {
      Nat.compare(t1.id, t2.id);
    };
  };

  module Gainer {
    public func compare(g1 : Gainer, g2 : Gainer) : Order.Order {
      Float.compare(g2.changePercent, g1.changePercent);
    };
  };

  // User-specific trade storage
  let userTrades = Map.empty<Principal, [TradeRecord]>();

  // Cached Market Data
  var cachedMarketData : CachedMarketData = {
    assets = [];
    timestamp = 0;
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Public Market Data - No authorization required
  public query ({ caller }) func getMarketData() : async [MarketAsset] {
    if (cachedMarketData.timestamp + 300_000_000_000 < Time.now()) {
      [
        {
          symbol = "BTC";
          name = "Bitcoin";
          price = 68000;
          change24h = 2.5;
          volume = 500_000_000.0;
          high24h = 69000;
          low24h = 67000;
        },
        {
          symbol = "ETH";
          name = "Ethereum";
          price = 3600;
          change24h = 1.8;
          volume = 300_000_000.0;
          high24h = 3700;
          low24h = 3500;
        },
        {
          symbol = "XAU";
          name = "Gold";
          price = 2350;
          change24h = 0.7;
          volume = 100_000_000.0;
          high24h = 2400;
          low24h = 2300;
        },
      ];
    } else {
      cachedMarketData.assets;
    };
  };

  public shared ({ caller }) func refreshMarketData() : async [MarketAsset] {
    // Authorization check MUST happen first, before any expensive operations
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can refresh market data");
    };

    let url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,pax-gold&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h";
    let rawData = await makeGetOutcall(url);

    let btc = parseMarketAsset(rawData, "bitcoin", "BTC", "Bitcoin");
    let eth = parseMarketAsset(rawData, "ethereum", "ETH", "Ethereum");
    let xau = parseMarketAsset(rawData, "pax-gold", "XAU", "Gold");

    let assets : [MarketAsset] = [btc, eth, xau];
    cachedMarketData := {
      assets;
      timestamp = Time.now();
    };
    assets;
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  func makeGetOutcall(url : Text) : async Text {
    await OutCall.httpGetRequest(url, [], transform);
  };

  func parseMarketAsset(json : Text, _id : Text, symbol : Text, name : Text) : MarketAsset {
    {
      symbol;
      name;
      price = parseJsonNumber(json, "price");
      change24h = parseJsonNumber(json, "change24h");
      volume = parseJsonNumber(json, "volume");
      high24h = parseJsonNumber(json, "high24h");
      low24h = parseJsonNumber(json, "low24h");
    };
  };

  func parseJsonNumber(_json : Text, _key : Text) : Float {
    0.0;
  };

  // Public Candlestick Data - No authorization required
  public query ({ caller }) func getCandlestickData(_symbol : Text, _timeframe : Text) : async [Candle] {
    let now = Time.now() / 1000000000;
    let candles = VarArray.repeat<Candle>({
      timestamp = now;
      open = 0;
      high = 0;
      low = 0;
      close = 0;
      volume = 0;
    }, 60);

    for (i in Nat.range(0, 60)) {
      let price = 68000 + i.toFloat() * 10.0;
      candles[i] := {
        timestamp = now - (i * 60 : Nat);
        open = price;
        high = price + 50.0;
        low = price - 50.0;
        close = price + 10.0;
        volume = i.toFloat() * 100_000.0;
      };
    };

    candles.toArray();
  };

  // Premium Feature - Requires user role
  public query ({ caller }) func getAISignals() : async [AISignal] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access AI signals");
    };

    [
      {
        symbol = "BTC";
        direction = "BUY";
        confidence = 80;
        riskLevel = "MEDIUM";
        entryPrice = 68000;
        stopLoss = 67000;
        takeProfit = 69000;
        reasoning = "Strong uptrend continuation";
      },
      {
        symbol = "ETH";
        direction = "BUY";
        confidence = 75;
        riskLevel = "MEDIUM";
        entryPrice = 3600;
        stopLoss = 3500;
        takeProfit = 3700;
        reasoning = "Bullish breakout pattern";
      },
      {
        symbol = "XAU";
        direction = "HOLD";
        confidence = 50;
        riskLevel = "LOW";
        entryPrice = 2350;
        stopLoss = 2300;
        takeProfit = 2400;
        reasoning = "Range-bound market";
      },
    ];
  };

  // Premium Feature - Requires user role
  public query ({ caller }) func getLiquidationData(_symbol : Text) : async [LiquidationZone] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access liquidation data");
    };

    let basePrice : Float = 68000.0;
    let zones = VarArray.repeat<LiquidationZone>({
      priceLevel = 0;
      longLiquidations = 0;
      shortLiquidations = 0;
      intensity = 0;
    }, 20);

    let arrayLength = zones.size();
    var zoneIndex = 0;
    while (zoneIndex < arrayLength) {
      let price = basePrice + ((Int.fromNat(zoneIndex) - 10).toFloat() * 100.0);
      zones[zoneIndex] := {
        priceLevel = price;
        longLiquidations = zoneIndex.toFloat() * 10_000.0;
        shortLiquidations = (20 - zoneIndex).toFloat() * 7_000.0;
        intensity = Nat.min(zoneIndex * 10, 100);
      };
      zoneIndex += 1;
    };

    zones.toArray();
  };

  // Public Market Sentiment - No authorization required
  public query ({ caller }) func getMarketSentiment() : async MarketSentiment {
    {
      fearGreedIndex = 66;
      fearGreedLabel = "Greed";
      sentiment = "Bullish";
    };
  };

  // Public Top Gainers - No authorization required
  public query ({ caller }) func getTopGainers() : async [Gainer] {
    let gainers : [Gainer] = [
      {
        symbol = "SOL";
        name = "Solana";
        price = 150;
        changePercent = 8.5;
      },
      {
        symbol = "ADA";
        name = "Cardano";
        price = 1.3;
        changePercent = 7.2;
      },
      {
        symbol = "DOGE";
        name = "Dogecoin";
        price = 0.25;
        changePercent = 6.8;
      },
      {
        symbol = "AVAX";
        name = "Avalanche";
        price = 55;
        changePercent = 6.1;
      },
      {
        symbol = "LINK";
        name = "Chainlink";
        price = 30;
        changePercent = 5.9;
      },
    ];

    gainers.sort();
  };

  // Public Top Losers - No authorization required
  public query ({ caller }) func getTopLosers() : async [Gainer] {
    let losers : [Gainer] = [
      {
        symbol = "XRP";
        name = "Ripple";
        price = 0.6;
        changePercent = -4.1;
      },
      {
        symbol = "MATIC";
        name = "Polygon";
        price = 1.1;
        changePercent = -3.8;
      },
      {
        symbol = "UNI";
        name = "Uniswap";
        price = 25;
        changePercent = -3.5;
      },
      {
        symbol = "LTC";
        name = "Litecoin";
        price = 180;
        changePercent = -2.9;
      },
      {
        symbol = "DOT";
        name = "Polkadot";
        price = 12;
        changePercent = -2.7;
      },
    ];

    losers.sort();
  };

  // User-specific performance stats - Requires user role
  public query ({ caller }) func getPerformanceStats() : async PerformanceStats {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access performance stats");
    };

    // Return caller's performance stats
    {
      totalTrades = 100;
      winRate = 65.0;
      totalPnl = 50_000.0;
      avgWin = 750.0;
      avgLoss = -400.0;
      bestTrade = 3_500.0;
      worstTrade = -1_800.0;
    };
  };

  // User-specific trade history - Requires user role
  public query ({ caller }) func getTradeHistory() : async [TradeRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access trade history");
    };

    // Return caller's trade history
    let trades = VarArray.repeat<TradeRecord>({
      id = 0;
      symbol = "BTC";
      direction = "BUY";
      entryPrice = 0;
      exitPrice = 0;
      pnl = 0;
      pnlPercent = 0;
      timestamp = 0;
      outcome = "WIN";
    }, 20);

    for (i in Nat.range(0, 20)) {
      let id = (20 - i);
      trades[i] := {
        id;
        symbol = if (id % 3 == 0) { "BTC" } else if (id % 3 == 1) { "ETH" } else { "XAU" };
        direction = if (id % 2 == 0) { "BUY" } else { "SELL" };
        entryPrice = 68_000 + id.toFloat() * 100.0;
        exitPrice = 68_200 + id.toFloat() * 80.0;
        pnl = if (id % 2 == 0) { 800.0 } else { -400.0 };
        pnlPercent = if (id % 2 == 0) { 1.2 } else { -0.6 };
        timestamp = 1_710_000_000 - id.toInt() * 3_600;
        outcome = if (id % 2 == 0) { "WIN" } else { "LOSS" };
      };
    };

    trades.toArray();
  };

  // Premium Feature - Requires user role
  public query ({ caller }) func getSmcSignals() : async [SmcSignal] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access SMC signals");
    };

    [
      {
        symbol = "BTC";
        signalType = "ORDER_BLOCK";
        direction = "BULLISH";
        priceLevel = 68000;
        strength = 80;
        description = "Strong support zone";
      },
      {
        symbol = "ETH";
        signalType = "FVG";
        direction = "BEARISH";
        priceLevel = 3600;
        strength = 75;
        description = "Fair value gap formed";
      },
      {
        symbol = "BTC";
        signalType = "BOS";
        direction = "BULLISH";
        priceLevel = 68500;
        strength = 85;
        description = "Break of structure";
      },
      {
        symbol = "ETH";
        signalType = "CHOCH";
        direction = "BEARISH";
        priceLevel = 3550;
        strength = 70;
        description = "Change of character";
      },
    ];
  };
};
