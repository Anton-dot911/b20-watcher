# B20 Risk Model v0.1

The score is not a price prediction. It estimates issuer-control and operational risk.

## Risk buckets

### Admin control

- Active `DEFAULT_ADMIN_ROLE`
- Recent role grants/revocations
- `LastAdminRenounced`

### Mint / supply

- Active `MINT_ROLE`
- No observed supply cap
- Recent `SupplyCapUpdated`
- Large mint or repeated mint activity

### Freeze / seize

- Active `BURN_BLOCKED_ROLE`
- Observed `BurnedBlocked`
- Restricted policy activity

### Pause

- Active `PAUSE_ROLE`
- Recent `Paused`
- Missing/active `UNPAUSE_ROLE` context

### Policy restriction

- `PolicyUpdated`
- Allowlist/blocklist policy activity
- Non-default policy IDs

### Metadata

- `METADATA_ROLE`
- `NameUpdated`
- `SymbolUpdated`
- `ContractURIUpdated`

## Risk levels

- 0–24: Low
- 25–49: Moderate
- 50–74: High
- 75–100: Critical

## Important note

Regulated tokens may intentionally use blocklists, freeze, burn, and transfer policies. The product should label these controls, not automatically call them malicious.
