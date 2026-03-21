import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfile {
    name: string;
    subscriptionTier: string;
    email: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum VideoDifficulty {
    beginner = "beginner",
    advanced = "advanced"
}
export interface backendInterface {
    addVideo(title: string, description: string, videoUrl: string, thumbnailUrl: string, difficulty: VideoDifficulty): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteVideo(videoId: bigint): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVideos(): Promise<Array<{
        id: bigint;
        title: string;
        thumbnailUrl: string;
        difficulty: string;
        description: string;
        uploaderPrincipal: Uint8Array;
        videoUrl: string;
        uploaded_at: bigint;
    }>>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
}
