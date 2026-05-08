-- TalkScout Phase 1 smoke test (final architecture).
-- Verifies the only SQL Server 2025 features we actually depend on:
-- the native VECTOR(768) data type and VECTOR_DISTANCE.
-- Embeddings are produced in Node via the `ollama` npm package, not in T-SQL.
--
-- Run via the MSSQL VS Code extension (recommended) or:
--   docker cp scripts/smoke-test.sql talkscout-mssql:/tmp/smoke-test.sql && \
--   docker exec -i talkscout-mssql /opt/mssql-tools18/bin/sqlcmd \
--     -S localhost -U sa -P 'TalkScout!Demo2026' -C -i /tmp/smoke-test.sql

PRINT '--- 0) Cleanup any external model from previous attempts ----------';

IF EXISTS (SELECT 1 FROM sys.external_models WHERE name = N'local_embed')
BEGIN
  DROP EXTERNAL MODEL local_embed;
  PRINT 'dropped legacy local_embed';
END
ELSE
  PRINT 'no legacy external model present';
GO

PRINT '--- 1) VECTOR(768) round-trip (native type lives in 2025) ---------';

DECLARE @v VECTOR(768) = CAST(
  '[' + STUFF(
    (SELECT CONCAT(',', CAST(0.1 + (n * 0.001) AS NVARCHAR(20)))
     FROM (SELECT TOP 768 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1 AS n
           FROM sys.all_objects a CROSS JOIN sys.all_objects b) x
     FOR XML PATH('')), 1, 1, '')
  + ']'
  AS VECTOR(768));

SELECT
  VECTORPROPERTY(@v, 'Dimensions') AS dims,
  VECTORPROPERTY(@v, 'BaseType')   AS base_type;
GO

PRINT '--- 2) VECTOR_DISTANCE between two literal vectors ----------------';

DECLARE @a VECTOR(3) = CAST('[1.0, 0.0, 0.0]' AS VECTOR(3));
DECLARE @b VECTOR(3) = CAST('[0.9, 0.1, 0.0]' AS VECTOR(3));
DECLARE @c VECTOR(3) = CAST('[0.0, 0.0, 1.0]' AS VECTOR(3));

SELECT
  VECTOR_DISTANCE('cosine', @a, @b) AS close_pair,
  VECTOR_DISTANCE('cosine', @a, @c) AS far_pair;
-- Expectation: close_pair < far_pair.
GO

PRINT '--- smoke test complete -------------------------------------------';
