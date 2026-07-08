# SQL queries

## Discover B20 tokens

```sql
SELECT
  block_timestamp,
  transaction_hash,
  parameters['token'] AS token_address,
  parameters['name'] AS name,
  parameters['symbol'] AS symbol,
  parameters['decimals'] AS decimals,
  parameters['variant'] AS variant,
  block_number,
  log_index
FROM base.events
WHERE event_signature = 'B20Created(address,uint8,string,string,uint8,bytes)'
  AND address = '0xB20f000000000000000000000000000000000000'
  AND action = 'added'
ORDER BY block_timestamp DESC
LIMIT 50;
```

## Token event timeline

```sql
SELECT
  block_timestamp,
  transaction_hash,
  event_name,
  event_signature,
  parameters,
  block_number,
  log_index
FROM base.events
WHERE address = '{token_address}'
  AND action = 'added'
  AND event_signature IN (
    'RoleGranted(bytes32,address,address)',
    'RoleRevoked(bytes32,address,address)',
    'LastAdminRenounced(address)',
    'Paused(address,uint8[])',
    'Unpaused(address,uint8[])',
    'PolicyUpdated(bytes32,uint64,uint64)',
    'SupplyCapUpdated(address,uint256,uint256)',
    'BurnedBlocked(address,address,uint256)',
    'NameUpdated(address,string)',
    'SymbolUpdated(address,string)',
    'ContractURIUpdated()',
    'MultiplierUpdated(uint256)',
    'Announcement(address,string,string,string)'
  )
ORDER BY block_timestamp ASC
LIMIT 1000;
```

## Memo payments

```sql
SELECT
  t.block_timestamp,
  t.transaction_hash,
  t.address AS token_address,
  t.parameters['from'] AS from_address,
  t.parameters['to'] AS to_address,
  t.parameters['value'] AS amount,
  m.parameters['memo'] AS memo
FROM base.events t
JOIN base.events m
  ON t.transaction_hash = m.transaction_hash
  AND m.address = t.address
  AND m.log_index = t.log_index + 1
WHERE t.event_signature = 'Transfer(address,address,uint256)'
  AND m.event_signature = 'Memo(address,bytes32)'
  AND t.address = '{token_address}'
  AND t.action = 'added'
  AND m.action = 'added'
ORDER BY t.block_timestamp DESC
LIMIT 100;
```
