import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Time "mo:core/Time";
import VarArray "mo:core/VarArray";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ─── Legacy types (kept for upgrade compatibility only) ───────────────────────
  // The previous backend version had these stable variables. They must be
  // declared here so the upgrade compatibility checker does not reject the
  // deployment. Their values are never read by new code.

  type _LegacyMarketAsset = {
    symbol : Text;
    name : Text;
    price : Float;
    change24h : Float;
    volume : Float;
    high24h : Float;
    low24h : Float;
  };

  type _LegacyCachedMarketData = {
    assets : [_LegacyMarketAsset];
    timestamp : Int;
  };

  type _LegacyUserProfile = {
    name : Text;
    email : Text;
    subscriptionTier : Text;
  };

  type _LegacyTradeRecord = {
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

  // Legacy stable variables retained for upgrade compatibility
  stable var cachedMarketData : _LegacyCachedMarketData = {
    assets = [];
    timestamp = 0;
  };
  let userProfiles = Map.empty<Principal, _LegacyUserProfile>();
  let userTrades = Map.empty<Principal, [_LegacyTradeRecord]>();

  // ─── Active types ───────────────────────────────────────────────────────────

  public type MarketAsset = {
    symbol : Text;
    name : Text;
    price : Float;
    change24h : Float;
    volume : Float;
    high24h : Float;
    low24h : Float;
  };

  public type Signal = {
    id : Nat;
    symbol : Text;
    direction : Text;
    entryPrice : Float;
    stopLoss : Float;
    takeProfit1 : Float;
    takeProfit2 : Float;
    confidence : Nat;
    outcome : Text;
    timestamp : Int;
    lockedUntil : Int;
  };

  // ─── State ──────────────────────────────────────────────────────────────────

  stable var nextSignalId : Nat = 1;
  let signals = Map.empty<Nat, Signal>();

  // ─── Market Data (static seed / fallback) ───────────────────────────────────

  public query func getMarketData() : async [MarketAsset] {
    [
      {
        symbol = "BTC";
        name = "Bitcoin";
        price = 68000.0;
        change24h = 0.0;
        volume = 0.0;
        high24h = 68500.0;
        low24h = 67500.0;
      },
      {
        symbol = "ETH";
        name = "Ethereum";
        price = 3600.0;
        change24h = 0.0;
        volume = 0.0;
        high24h = 3650.0;
        low24h = 3550.0;
      },
      {
        symbol = "XAU";
        name = "Gold";
        price = 2350.0;
        change24h = 0.0;
        volume = 0.0;
        high24h = 2370.0;
        low24h = 2330.0;
      },
    ];
  };

  // ─── Signal Storage ─────────────────────────────────────────────────────────

  public shared func saveSignal(
    symbol : Text,
    direction : Text,
    entryPrice : Float,
    stopLoss : Float,
    takeProfit1 : Float,
    takeProfit2 : Float,
    confidence : Nat,
    lockedUntil : Int,
  ) : async Nat {
    let id = nextSignalId;
    nextSignalId += 1;
    let signal : Signal = {
      id;
      symbol;
      direction;
      entryPrice;
      stopLoss;
      takeProfit1;
      takeProfit2;
      confidence;
      outcome = "PENDING";
      timestamp = Time.now();
      lockedUntil;
    };
    signals.add(id, signal);
    id;
  };

  public query func getSignalHistory() : async [Signal] {
    let result = VarArray.repeat<Signal>({
      id = 0;
      symbol = "";
      direction = "";
      entryPrice = 0.0;
      stopLoss = 0.0;
      takeProfit1 = 0.0;
      takeProfit2 = 0.0;
      confidence = 0;
      outcome = "PENDING";
      timestamp = 0;
      lockedUntil = 0;
    }, signals.size());
    var i = 0;
    for ((_, s) in signals.entries()) {
      result[i] := s;
      i += 1;
    };
    result.toArray();
  };

  public shared func updateSignalOutcome(id : Nat, outcome : Text) : async () {
    switch (signals.get(id)) {
      case null {};
      case (?sig) {
        signals.add(id, {
          id = sig.id;
          symbol = sig.symbol;
          direction = sig.direction;
          entryPrice = sig.entryPrice;
          stopLoss = sig.stopLoss;
          takeProfit1 = sig.takeProfit1;
          takeProfit2 = sig.takeProfit2;
          confidence = sig.confidence;
          outcome;
          timestamp = sig.timestamp;
          lockedUntil = sig.lockedUntil;
        });
      };
    };
  };

  public query func getWinRate() : async Float {
    var wins : Float = 0.0;
    var total : Float = 0.0;
    for ((_, s) in signals.entries()) {
      if (s.outcome != "PENDING") {
        total += 1.0;
        if (s.outcome == "WIN_TP1" or s.outcome == "WIN_TP2") {
          wins += 1.0;
        };
      };
    };
    if (total == 0.0) { 0.0 } else { wins / total * 100.0 };
  };
};
