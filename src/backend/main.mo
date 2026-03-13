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

  // ─── Gemini Analysis Types ─────────────────────────────────────────────────

  public type GeminiAnalysis = {
    marketBias : Text;
    confidence : Nat;
    strategicInsight : Text;
    signal : Text;
    rawText : Text;
  };

  // ─── Research Report Type ──────────────────────────────────────────────────

  public type ResearchReport = {
    ticker : Text;
    assetType : Text;
    executiveSummary : Text;
    fundamentalHealth : Text;
    technicalOutlook : Text;
    priceTargets : Text;
    riskAssessment : Text;
    keyCatalysts : Text;
    overallRating : Text;
    rawText : Text;
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

  // Public Market Data - No authorization required. Always returns data.
  public query func getMarketData() : async [MarketAsset] {
    if (cachedMarketData.assets.size() > 0) {
      return cachedMarketData.assets;
    };
    [
      { symbol = "BTC"; name = "Bitcoin"; price = 68000; change24h = 2.5; volume = 500_000_000.0; high24h = 69000; low24h = 67000 },
      { symbol = "ETH"; name = "Ethereum"; price = 3600; change24h = 1.8; volume = 300_000_000.0; high24h = 3700; low24h = 3500 },
      { symbol = "XAU"; name = "Gold"; price = 2350; change24h = 0.7; volume = 100_000_000.0; high24h = 2400; low24h = 2300 },
    ]
  };

  public shared ({ caller }) func refreshMarketData() : async [MarketAsset] {
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

  // Public Candlestick Data
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

  public query ({ caller }) func getLiquidationData(_symbol : Text) : async [LiquidationZone] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access liquidation data");
    };

    let basePrice : Float = 68000.0;
    let arrayLength = 20;
    let zones = VarArray.repeat<LiquidationZone>({
      priceLevel = 0;
      longLiquidations = 0;
      shortLiquidations = 0;
      intensity = 0;
    }, arrayLength);

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

  public query ({ caller }) func getMarketSentiment() : async MarketSentiment {
    {
      fearGreedIndex = 66;
      fearGreedLabel = "Greed";
      sentiment = "Bullish";
    };
  };

  public query ({ caller }) func getTopGainers() : async [Gainer] {
    let gainers : [Gainer] = [
      { symbol = "SOL"; name = "Solana"; price = 150; changePercent = 8.5 },
      { symbol = "ADA"; name = "Cardano"; price = 1.3; changePercent = 7.2 },
      { symbol = "DOGE"; name = "Dogecoin"; price = 0.25; changePercent = 6.8 },
      { symbol = "AVAX"; name = "Avalanche"; price = 55; changePercent = 6.1 },
      { symbol = "LINK"; name = "Chainlink"; price = 30; changePercent = 5.9 },
    ];
    gainers.sort();
  };

  public query ({ caller }) func getTopLosers() : async [Gainer] {
    let losers : [Gainer] = [
      { symbol = "XRP"; name = "Ripple"; price = 0.6; changePercent = -4.1 },
      { symbol = "MATIC"; name = "Polygon"; price = 1.1; changePercent = -3.8 },
      { symbol = "UNI"; name = "Uniswap"; price = 25; changePercent = -3.5 },
      { symbol = "LTC"; name = "Litecoin"; price = 180; changePercent = -2.9 },
      { symbol = "DOT"; name = "Polkadot"; price = 12; changePercent = -2.7 },
    ];
    losers.sort();
  };

  public query ({ caller }) func getPerformanceStats() : async PerformanceStats {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access performance stats");
    };
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

  public query ({ caller }) func getTradeHistory() : async [TradeRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access trade history");
    };

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

  public query ({ caller }) func getSmcSignals() : async [SmcSignal] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access SMC signals");
    };

    [
      { symbol = "BTC"; signalType = "ORDER_BLOCK"; direction = "BULLISH"; priceLevel = 68000; strength = 80; description = "Strong support zone" },
      { symbol = "ETH"; signalType = "FVG"; direction = "BEARISH"; priceLevel = 3600; strength = 75; description = "Fair value gap formed" },
      { symbol = "BTC"; signalType = "BOS"; direction = "BULLISH"; priceLevel = 68500; strength = 85; description = "Break of structure" },
      { symbol = "ETH"; signalType = "CHOCH"; direction = "BEARISH"; priceLevel = 3550; strength = 70; description = "Change of character" },
    ];
  };

  // ─── Text Utilities ────────────────────────────────────────────────────────

  func sliceAfter(text : Text, prefix : Text) : Text {
    let pSize = prefix.size();
    let tChars = text.toArray();
    if (tChars.size() <= pSize) return "";
    var result = "";
    var k = pSize;
    while (k < tChars.size()) {
      result #= Text.fromChar(tChars[k]);
      k += 1;
    };
    result;
  };

  // Extracts the text field from the Gemini API response JSON envelope
  func extractGeminiContent(body : Text) : Text {
    let marker = "\"text\":\"";
    let mChars = marker.toArray();
    let bChars = body.toArray();
    let mSize = mChars.size();
    let bSize = bChars.size();
    var i = 0;
    while (i + mSize <= bSize) {
      var matched = true;
      var j = 0;
      while (j < mSize) {
        if (bChars[i + j] != mChars[j]) {
          matched := false;
          j := mSize;
        } else {
          j += 1;
        };
      };
      if (matched) {
        var result = "";
        var k = i + mSize;
        var escaped = false;
        label readValue while (k < bSize) {
          let c = bChars[k];
          if (escaped) {
            if (Text.fromChar(c) == "n") { result #= "\n" }
            else if (Text.fromChar(c) == "t") { result #= "\t" }
            else { result #= Text.fromChar(c) };
            escaped := false;
          } else if (Text.fromChar(c) == "\\") {
            escaped := true;
          } else if (Text.fromChar(c) == "\"") {
            break readValue;
          } else {
            result #= Text.fromChar(c);
          };
          k += 1;
        };
        return result;
      };
      i += 1;
    };
    "";
  };

  // Extracts a JSON string field value: finds "key":"value" and returns value
  func extractJsonStringField(json : Text, key : Text) : Text {
    let marker = "\"" # key # "\":\"";
    let mChars = marker.toArray();
    let jChars = json.toArray();
    let mSize = mChars.size();
    let jSize = jChars.size();
    var i = 0;
    while (i + mSize <= jSize) {
      var matched = true;
      var j = 0;
      while (j < mSize) {
        if (jChars[i + j] != mChars[j]) {
          matched := false;
          j := mSize;
        } else {
          j += 1;
        };
      };
      if (matched) {
        var result = "";
        var k = i + mSize;
        var escaped = false;
        label readStr while (k < jSize) {
          let c = jChars[k];
          if (escaped) {
            result #= Text.fromChar(c);
            escaped := false;
          } else if (Text.fromChar(c) == "\\") {
            escaped := true;
          } else if (Text.fromChar(c) == "\"") {
            break readStr;
          } else {
            result #= Text.fromChar(c);
          };
          k += 1;
        };
        return result;
      };
      i += 1;
    };
    "";
  };

  // Extracts a JSON numeric field value: finds "key":N and returns N as Nat
  func extractJsonNatField(json : Text, key : Text) : Nat {
    let marker = "\"" # key # "\":";
    let mChars = marker.toArray();
    let jChars = json.toArray();
    let mSize = mChars.size();
    let jSize = jChars.size();
    var i = 0;
    while (i + mSize <= jSize) {
      var matched = true;
      var j = 0;
      while (j < mSize) {
        if (jChars[i + j] != mChars[j]) {
          matched := false;
          j := mSize;
        } else {
          j += 1;
        };
      };
      if (matched) {
        var numStr = "";
        var k = i + mSize;
        // skip whitespace
        while (k < jSize and Text.fromChar(jChars[k]) == " ") { k += 1 };
        label readNum while (k < jSize) {
          let c = Text.fromChar(jChars[k]);
          if (c == "0" or c == "1" or c == "2" or c == "3" or c == "4" or
              c == "5" or c == "6" or c == "7" or c == "8" or c == "9") {
            numStr #= c;
            k += 1;
          } else {
            break readNum;
          };
        };
        switch (Nat.fromText(numStr)) {
          case (?n) { return if (n > 100) 100 else n };
          case null { return 50 };
        };
      };
      i += 1;
    };
    50;
  };

  // Parses strict JSON response from Gemini for analyzeWithGemini
  // Expected: {"bias":"...","confidence":N,"signal":"...","insight":"..."}
  func parseGeminiJson(raw : Text) : GeminiAnalysis {
    // Strip any markdown code fences if Gemini added them despite instructions
    var cleaned = raw;
    // Remove ```json and ``` if present
    if (cleaned.startsWith(#text "```")) {
      // find first newline and strip header
      let chars = cleaned.toArray();
      var start = 0;
      while (start < chars.size() and Text.fromChar(chars[start]) != "\n") {
        start += 1;
      };
      if (start < chars.size()) {
        var s = "";
        var k = start + 1;
        while (k < chars.size()) {
          s #= Text.fromChar(chars[k]);
          k += 1;
        };
        cleaned := s;
      };
    };
    // Remove trailing ```
    if (cleaned.endsWith(#text "```")) {
      let chars = cleaned.toArray();
      var endIdx = chars.size();
      while (endIdx > 0 and Text.fromChar(chars[endIdx - 1]) == "`") {
        endIdx -= 1;
      };
      var s = "";
      var k = 0;
      while (k < endIdx) {
        s #= Text.fromChar(chars[k]);
        k += 1;
      };
      cleaned := s;
    };
    cleaned := cleaned.trim(#predicate(func(c : Char) : Bool { c == ' ' or c == '\n' or c == '\r' }));

    let bias = extractJsonStringField(cleaned, "bias");
    let confidence = extractJsonNatField(cleaned, "confidence");
    let signal = extractJsonStringField(cleaned, "signal");
    let insight = extractJsonStringField(cleaned, "insight");

    {
      marketBias = if (bias.size() > 0) bias else "Neutral";
      confidence = if (confidence == 0) 50 else confidence;
      signal = if (signal.size() > 0) signal else "NEUTRAL";
      strategicInsight = if (insight.size() > 0) insight else "Analysis pending.";
      rawText = raw;
    };
  };

  // ─── Gemini 2.0 Flash Analysis ────────────────────────────────────────────
  // All AI analysis uses gemini-2.0-flash exclusively.

  public shared func analyzeWithGemini(marketData : Text) : async Text {
    let apiKey = "AIzaSyCWa67g5dBoBapoigC4ULhkgl70WSaWsN8";
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" # apiKey;

    let sysInstruction = "You are a Master Institutional Trader specializing in Smart Money Concepts (SMC). Analyze the provided market data. Return your analysis in plain text using EXACTLY this format (no JSON, no markdown):\nBIAS: [BULLISH or BEARISH or NEUTRAL]\nCONFIDENCE: [0-100]\nSIGNAL: [STRONG BUY or BUY or NEUTRAL or SELL or STRONG SELL]\nINSIGHT: [one concise sentence about the 5-minute scalping setup]";

    let safetySettings = "[{\"category\":\"HARM_CATEGORY_HARASSMENT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_HATE_SPEECH\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_SEXUALLY_EXPLICIT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_DANGEROUS_CONTENT\",\"threshold\":\"BLOCK_NONE\"}]";

    let reqBody = "{\"system_instruction\":{\"parts\":[{\"text\":\"" # sysInstruction # "\"}]},"
      # "\"safetySettings\":" # safetySettings # ","
      # "\"contents\":[{\"parts\":[{\"text\":\"" # marketData # "\"}]}]}";

    let hdrs : [OutCall.Header] = [
      { name = "Content-Type"; value = "application/json" },
    ];

    try {
      let responseText = await OutCall.httpPostRequest(url, hdrs, reqBody, transform);
      let content = extractGeminiContent(responseText);
      if (content.size() == 0) {
        return "BIAS: NEUTRAL\nCONFIDENCE: 50\nSIGNAL: NEUTRAL\nINSIGHT: Gemini analysis temporarily unavailable.";
      };
      content;
    } catch (_) {
      "BIAS: NEUTRAL\nCONFIDENCE: 50\nSIGNAL: NEUTRAL\nINSIGHT: AI analysis temporarily unavailable. Please try again.";
    };
  };

  // ─── Gemini 2.0 Flash Deep Research ─────────────────────────────────────────
  // Uses gemini-2.0-flash for comprehensive multi-section research reports.
  // Supports stocks (NVDA, AAPL), crypto (BTC, ETH), and forex (XAU/USD).

  func extractSection(text : Text, sectionLabel : Text) : Text {
    let labelChars = sectionLabel.toArray();
    let textChars = text.toArray();
    let lSize = labelChars.size();
    let tSize = textChars.size();
    var i = 0;
    label searchLabel while (i + lSize <= tSize) {
      var matched = true;
      var j = 0;
      while (j < lSize) {
        if (textChars[i + j] != labelChars[j]) {
          matched := false;
          j := lSize;
        } else {
          j += 1;
        };
      };
      if (matched) {
        var k = i + lSize;
        while (k < tSize and (Text.fromChar(textChars[k]) == ":" or Text.fromChar(textChars[k]) == " " or Text.fromChar(textChars[k]) == "\n" or Text.fromChar(textChars[k]) == "\r")) {
          k += 1;
        };
        var result = "";
        var prev = ' ';
        label readSection while (k < tSize) {
          let c = textChars[k];
          let cStr = Text.fromChar(c);
          if (Text.fromChar(prev) == "\n" and cStr == "\n") {
            var peek = k + 1;
            while (peek < tSize and (Text.fromChar(textChars[peek]) == " " or Text.fromChar(textChars[peek]) == "\n" or Text.fromChar(textChars[peek]) == "\r")) {
              peek += 1;
            };
            if (peek < tSize) {
              let nextC = Text.fromChar(textChars[peek]);
              if (nextC == "E" or nextC == "F" or nextC == "T" or nextC == "P" or nextC == "R" or nextC == "K" or nextC == "O") {
                break readSection;
              };
            };
          };
          result #= cStr;
          prev := c;
          k += 1;
        };
        return result.trim(#predicate(func(c : Char) : Bool { c == ' ' or c == '\n' or c == '\r' }));
      };
      i += 1;
    };
    "";
  };

  func parseResearchReport(raw : Text, ticker : Text, assetType : Text) : ResearchReport {
    let exec = extractSection(raw, "EXECUTIVE SUMMARY");
    let fund = extractSection(raw, "FUNDAMENTAL HEALTH");
    let tech = extractSection(raw, "TECHNICAL OUTLOOK");
    let price = extractSection(raw, "PRICE TARGETS");
    let risk = extractSection(raw, "RISK ASSESSMENT");
    let catalysts = extractSection(raw, "KEY CATALYSTS");
    let rating = extractSection(raw, "OVERALL RATING");

    {
      ticker;
      assetType;
      executiveSummary = if (exec.size() > 0) exec else "Analysis in progress.";
      fundamentalHealth = if (fund.size() > 0) fund else "Fundamental data being compiled.";
      technicalOutlook = if (tech.size() > 0) tech else "Technical analysis in progress.";
      priceTargets = if (price.size() > 0) price else "Price targets being calculated.";
      riskAssessment = if (risk.size() > 0) risk else "Risk assessment in progress.";
      keyCatalysts = if (catalysts.size() > 0) catalysts else "Catalysts being identified.";
      overallRating = if (rating.size() > 0) rating else "NEUTRAL";
      rawText = raw;
    };
  };

  public shared func researchWithGemini(ticker : Text) : async Text {
    let apiKey = "AIzaSyCWa67g5dBoBapoigC4ULhkgl70WSaWsN8";
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" # apiKey;

    let sysInstruction = "You are a senior institutional research analyst. Provide a comprehensive research report in plain text. Structure your response using EXACTLY these section headers (each on its own line): EXECUTIVE SUMMARY, FUNDAMENTAL HEALTH, TECHNICAL OUTLOOK, PRICE TARGETS, RISK ASSESSMENT, KEY CATALYSTS, OVERALL RATING. Each section: 3-5 sentences. PRICE TARGETS: include Bear/Base/Bull scenarios with numbers. OVERALL RATING: STRONG BUY, BUY, HOLD, SELL, or STRONG SELL followed by rationale. No markdown, no bullet points with -.";

    let userMsg = "Generate a comprehensive institutional research report for " # ticker # ". Use your training knowledge for estimates. Be direct and specific with price targets.";

    let safetySettings = "[{\"category\":\"HARM_CATEGORY_HARASSMENT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_HATE_SPEECH\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_SEXUALLY_EXPLICIT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_DANGEROUS_CONTENT\",\"threshold\":\"BLOCK_NONE\"}]";

    let generationConfig = "{\"temperature\":0.3,\"maxOutputTokens\":1500}";

    let reqBody = "{\"system_instruction\":{\"parts\":[{\"text\":\"" # sysInstruction # "\"}]},"
      # "\"safetySettings\":" # safetySettings # ","
      # "\"generationConfig\":" # generationConfig # ","
      # "\"contents\":[{\"parts\":[{\"text\":\"" # userMsg # "\"}]}]}";

    let hdrs : [OutCall.Header] = [
      { name = "Content-Type"; value = "application/json" },
    ];

    try {
      let responseText = await OutCall.httpPostRequest(url, hdrs, reqBody, transform);
      let content = extractGeminiContent(responseText);
      if (content.size() == 0) {
        return "EXECUTIVE SUMMARY\nAI analysis temporarily unavailable for " # ticker # ". Please try again.\n\nOVERALL RATING\nNEUTRAL - Insufficient data.";
      };
      content;
    } catch (_) {
      "EXECUTIVE SUMMARY\nAI analysis temporarily unavailable for " # ticker # ". System re-aligning, please wait.\n\nOVERALL RATING\nNEUTRAL - Service temporarily unavailable.";
    };
  };

  // ─── Gemini 2.0 Flash Sentiment Analysis from News Headlines ─────────────

  public shared func getSentimentFromNews(headlines : [Text]) : async GeminiAnalysis {
    let apiKey = "AIzaSyCWa67g5dBoBapoigC4ULhkgl70WSaWsN8";
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" # apiKey;

    let sysInstruction = "You are a senior market sentiment analyst. Your response must be a single JSON object with NO markdown, NO code blocks, and NO extra text. If you add anything else, the system breaks. Return exactly: {\"bias\":\"Bullish or Bearish or Neutral\",\"confidence\":75,\"signal\":\"STRONG BUY or BUY or NEUTRAL or SELL or STRONG SELL\",\"insight\":\"one concise sentence summarizing market sentiment\"}";

    var headlinesText = "";
    var idx = 0;
    while (idx < headlines.size()) {
      headlinesText #= (idx + 1).toText() # ". " # headlines[idx] # "\n";
      idx += 1;
    };

    let userMsg = "Analyze the market sentiment from these headlines and return ONLY the JSON object:\n" # headlinesText;

    let safetySettings = "[{\"category\":\"HARM_CATEGORY_HARASSMENT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_HATE_SPEECH\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_SEXUALLY_EXPLICIT\",\"threshold\":\"BLOCK_NONE\"},{\"category\":\"HARM_CATEGORY_DANGEROUS_CONTENT\",\"threshold\":\"BLOCK_NONE\"}]";

    let reqBody = "{\"system_instruction\":{\"parts\":[{\"text\":\"" # sysInstruction # "\"}]},"
      # "\"safetySettings\":" # safetySettings # ","
      # "\"contents\":[{\"parts\":[{\"text\":\"" # userMsg # "\"}]}]}";

    let hdrs : [OutCall.Header] = [
      { name = "Content-Type"; value = "application/json" },
    ];

    try {
      let responseText = await OutCall.httpPostRequest(url, hdrs, reqBody, transform);
      let content = extractGeminiContent(responseText);
      if (content.size() == 0) {
        return {
          marketBias = "Neutral";
          confidence = 50;
          signal = "NEUTRAL";
          strategicInsight = "Sentiment analysis unavailable.";
          rawText = responseText;
        };
      };
      parseGeminiJson(content);
    } catch (_) {
      {
        marketBias = "Neutral";
        confidence = 50;
        signal = "NEUTRAL";
        strategicInsight = "Gemini 2.0 Flash sentiment API temporarily unavailable.";
        rawText = "";
      };
    };
  };

};
