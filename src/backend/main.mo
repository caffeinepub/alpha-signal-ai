import Float "mo:core/Float";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import VarArray "mo:core/VarArray";
import Order "mo:core/Order";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Array "mo:core/Array";

import MixinStorage "blob-storage/Mixin";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Blob "mo:core/Blob";


actor {
  // Include storage system
  include MixinStorage();

  // Include authorization system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Authentication Types and Data Stores
  public type UserAccount = {
    id : Nat;
    name : Text;
    email : Text;
    phone : Text;
    passwordHash : Text;
    role : Text;
    createdAt : Int;
    isBanned : Bool;
  };

  public type Session = {
    token : Text;
    userId : Nat;
    role : Text;
    createdAt : Int;
    expiresAt : Int;
  };

  public type OTPRecord = {
    phone : Text;
    otp : Text;
    expiresAt : Int;
  };

  var nextUserId = 1;
  let userAccounts = Map.empty<Nat, UserAccount>();
  let sessions = Map.empty<Text, Session>();
  let otpRecords = Map.empty<Text, OTPRecord>();

  // Admin email constant - only this email gets admin role
  let adminEmail : Text = "prakash.brjn01@gmail.com";

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

  type Video = {
    id : Nat;
    title : Text;
    description : Text;
    videoUrl : Text;
    thumbnailUrl : Text;
    difficulty : VideoDifficulty;
    uploaded_at : Int;
    uploaderPrincipal : Principal;
  };

  type VideoDifficulty = {
    #beginner;
    #advanced;
  };

  // User-specific trade storage
  let userTrades = Map.empty<Principal, [TradeRecord]>();

  // Cached Market Data
  var cachedMarketData : CachedMarketData = {
    assets = [];
    timestamp = 0;
  };

  // Video storage
  let videos = Map.empty<Nat, Video>();
  var nextVideoId = 1;

  // Affiliate click tracking
  type AffiliateClick = {
    exchange : Text;
    assetSymbol : Text;
    timestamp : Int;
  };

  var nextAffiliateId : Nat = 0;
  let affiliateClickStore = Map.empty<Nat, AffiliateClick>();

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

  // ───── User Profile Management ─────────────────────────────────────────────

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
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

  // Video Learning Section
  public shared ({ caller }) func addVideo(
    title : Text,
    description : Text,
    videoUrl : Text,
    thumbnailUrl : Text,
    difficulty : VideoDifficulty
  ) : async Nat {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can add videos");
    };

    if (title.trim(#predicate(func(c) { c == ' ' })).size() == 0) {
      Runtime.trap("Video title cannot be empty");
    };

    if (videoUrl.trim(#predicate(func(c) { c == ' ' })).size() == 0) {
      Runtime.trap("Video URL cannot be empty");
    };

    let video : Video = {
      id = nextVideoId;
      title = title.trim(#predicate(func(c) { c == ' ' }));
      description = description.trim(#predicate(func(c) { c == ' ' }));
      videoUrl = videoUrl.trim(#predicate(func(c) { c == ' ' }));
      thumbnailUrl = thumbnailUrl.trim(#predicate(func(c) { c == ' ' }));
      difficulty;
      uploaded_at = Time.now();
      uploaderPrincipal = caller;
    };

    videos.add(nextVideoId, video);
    let videoId = nextVideoId;
    nextVideoId += 1;
    videoId;
  };

  module VideoSort {
    public func compare(a : Video, b : Video) : Order.Order {
      Int.compare(b.uploaded_at, a.uploaded_at);
    };
  };

  func formatDifficulty(difficulty : VideoDifficulty) : Text {
    switch (difficulty) {
      case (#beginner) { "Beginner" };
      case (#advanced) { "Advanced" };
    };
  };

  func videoToFrontend(video : Video) : {
    id : Nat;
    title : Text;
    description : Text;
    videoUrl : Text;
    thumbnailUrl : Text;
    difficulty : Text;
    uploaded_at : Int;
    uploaderPrincipal : Blob;
  } {
    {
      id = video.id;
      title = video.title;
      description = video.description;
      videoUrl = video.videoUrl;
      thumbnailUrl = video.thumbnailUrl;
      difficulty = formatDifficulty(video.difficulty);
      uploaded_at = video.uploaded_at;
      uploaderPrincipal = video.uploaderPrincipal.toBlob();
    };
  };

  public query ({ caller }) func getVideos() : async [{
    id : Nat;
    title : Text;
    description : Text;
    videoUrl : Text;
    thumbnailUrl : Text;
    difficulty : Text;
    uploaded_at : Int;
    uploaderPrincipal : Blob;
  }] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access video content");
    };

    let videosArray = videos.values().toArray();
    let sortedVideos = videosArray.sort();
    sortedVideos.map(
      videoToFrontend
    );
  };

  public shared ({ caller }) func deleteVideo(videoId : Nat) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can delete videos");
    };

    switch (videos.get(videoId)) {
      case (null) {
        Runtime.trap("Video not found");
      };
      case (_video) {
        videos.remove(videoId);
      };
    };
  };
};
