use anchor_lang::prelude::*;

// Replace with your deployed program ID (run `anchor keys sync` after first build).
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod gillty {
    use super::*;

    /// Register a media fingerprint. The account address is a PDA derived from
    /// the hash itself (seeds = ["fp", media_hash]), so it can only ever be
    /// created once per set of bytes, and anyone can later find it by re-hashing
    /// the media. The timestamp comes from the on-chain Clock, never the client.
    #[allow(clippy::too_many_arguments)]
    pub fn register_fingerprint(
        ctx: Context<RegisterFingerprint>,
        media_hash: [u8; 32],
        device_pubkey: [u8; 32],
        _signature: [u8; 64], // verified off-chain in the MVP; see note below
        flag: u8,
        liveness: u8,      // 1 = a server-verified liveness check passed at capture
        base_uid: [u8; 32], // EAS attestation UID on Base (zeroed if not mirrored)
        capture_nonce: [u8; 32], // server challenge the capture was bound to
        face_hash: [u8; 32],     // hash of the liveness face template (zeroed if none)
        ttl_seconds: i64,        // 0 = never expires
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let fp = &mut ctx.accounts.fingerprint;
        fp.media_hash = media_hash;
        fp.device_pubkey = device_pubkey;
        fp.registrant = ctx.accounts.registrant.key();
        fp.unix_ts = now;
        fp.expires_at = if ttl_seconds > 0 { now + ttl_seconds } else { 0 };
        fp.flag = flag;
        fp.liveness = liveness;
        fp.revoked = 0;
        fp.capture_nonce = capture_nonce;
        fp.face_hash = face_hash;
        fp.base_uid = base_uid;
        fp.bump = ctx.bumps.fingerprint;
        Ok(())
    }

    /// Revoke a seal. Only the original registrant may revoke, so a seal found
    /// to be fraudulent can be invalidated without deleting the audit trail —
    /// verifiers see an explicit "revoked" state rather than a missing record.
    pub fn revoke_fingerprint(ctx: Context<RevokeFingerprint>, _media_hash: [u8; 32]) -> Result<()> {
        let fp = &mut ctx.accounts.fingerprint;
        require_keys_eq!(
            fp.registrant,
            ctx.accounts.registrant.key(),
            GilltyError::NotRegistrant
        );
        fp.revoked = 1;
        Ok(())
    }
}

#[error_code]
pub enum GilltyError {
    #[msg("Only the original registrant can revoke this seal.")]
    NotRegistrant,
}

#[derive(Accounts)]
#[instruction(media_hash: [u8; 32])]
pub struct RegisterFingerprint<'info> {
    #[account(
        init,
        payer = registrant,
        space = Fingerprint::SIZE,
        seeds = [b"fp", media_hash.as_ref()],
        bump
    )]
    pub fingerprint: Account<'info, Fingerprint>,
    #[account(mut)]
    pub registrant: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(media_hash: [u8; 32])]
pub struct RevokeFingerprint<'info> {
    #[account(
        mut,
        seeds = [b"fp", media_hash.as_ref()],
        bump = fingerprint.bump
    )]
    pub fingerprint: Account<'info, Fingerprint>,
    pub registrant: Signer<'info>,
}

#[account]
pub struct Fingerprint {
    pub media_hash: [u8; 32],
    pub device_pubkey: [u8; 32],
    pub registrant: Pubkey,
    pub unix_ts: i64,
    pub expires_at: i64, // 0 = never expires
    pub flag: u8,
    pub liveness: u8,
    pub revoked: u8,
    pub capture_nonce: [u8; 32],
    pub face_hash: [u8; 32],
    pub base_uid: [u8; 32],
    pub bump: u8,
}

impl Fingerprint {
    // 8 disc + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1;
}

// NOTE (roadmap): the device signature is currently checked in the API before
// submission. To make it trustless on-chain, verify the Ed25519 signature using
// the Ed25519 program + instructions sysvar, or pass it through and check inside
// this instruction. Kept off-chain here to keep the hackathon program minimal.
