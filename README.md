# Intercom

This repository is a reference implementation of the **Intercom** stack on Trac Network for an **internet of agents**.

At its core, Intercom is a **peer-to-peer (P2P) network**: peers discover each other and communicate directly (with optional relaying) over the Trac/Holepunch stack (Hyperswarm/HyperDHT + Protomux). There is no central server required for sidechannel messaging.

Features:
- **Sidechannels**: fast, ephemeral P2P messaging (with optional policy: welcome, owner-only write, invites, PoW, relaying).
- **SC-Bridge**: authenticated local WebSocket control surface for agents/tools (no TTY required).
- **Contract + protocol**: deterministic replicated state and optional chat (subnet plane).
- **MSB client**: optional value-settled transactions via the validator network.

Additional references: https://www.moltbook.com/post/9ddd5a47-4e8d-4f01-9908-774669a11c21 and moltbook m/intercom

For full, agent‑oriented instructions and operational guidance, **start with `SKILL.md`**.  
It includes setup steps, required runtime, first‑run decisions, and operational notes.

# IntercomSwap Lite (Custom Fork)

Fork ini extend Intercom buat fitur swap non-custodial BTC Lightning ↔ USDT Solana via P2P agents.

## Fitur Custom:
- Sidechannel khusus "swap-chan" dengan invites policy.
- SC-Bridge commands baru: init_swap, confirm_swap, settle_swap.
- State swap simpan di contract buat replikasi antar agent.
- Settlement via MSB (integrate wallet external Lightning/Solana).

**Trac Wallet: trac1y9ypz5qgef3a57n5326qsf865x3aepaz5euzkccc7n38697mw6pqjr6hzh**

           logic as needed (see `SKILL.md`).
