-- @param {String} $1:eventsJson  A JSON array of events, each with all Event fields plus
--                                 an `embedding` field that is a JSON array of 768 floats
--                                 (or null to leave the embedding unchanged on existing rows).
--                                 Schema per element:
--                                 {
--                                   slug, name, startDate, endDate,
--                                   locationCity, locationCountry, isVirtual,
--                                   topics, description,
--                                   cfpOpenDate, cfpCloseDate, cfpUrl,
--                                   contentHash, embedding
--                                 }
--
-- Behavior: MERGE on slug. Inserts new rows. Updates existing rows only when
-- contentHash differs (re-embedding is the caller's responsibility before passing
-- a new embedding for changed content). Returns inserted/updated/unchanged counts.
DECLARE @inserted INT = 0, @updated INT = 0, @unchanged INT = 0;

MERGE Event AS target
USING (
    SELECT
        slug,
        name,
        CONVERT(DATETIME2, startDate, 23) AS startDate,
        CONVERT(DATETIME2, endDate, 23) AS endDate,
        locationCity,
        locationCountry,
        isVirtual,
        topics,
        description,
        TRY_CONVERT(DATETIME2, cfpOpenDate, 23) AS cfpOpenDate,
        TRY_CONVERT(DATETIME2, cfpCloseDate, 23) AS cfpCloseDate,
        cfpUrl,
        contentHash,
        embedding
    FROM OPENJSON(@P1)
    WITH (
        slug            NVARCHAR(200)  '$.slug',
        name            NVARCHAR(500)  '$.name',
        startDate       NVARCHAR(40)   '$.startDate',
        endDate         NVARCHAR(40)   '$.endDate',
        locationCity    NVARCHAR(200)  '$.locationCity',
        locationCountry NVARCHAR(200)  '$.locationCountry',
        isVirtual       BIT            '$.isVirtual',
        topics          NVARCHAR(MAX)  '$.topics',
        description     NVARCHAR(MAX)  '$.description',
        cfpOpenDate     NVARCHAR(40)   '$.cfpOpenDate',
        cfpCloseDate    NVARCHAR(40)   '$.cfpCloseDate',
        cfpUrl          NVARCHAR(1000) '$.cfpUrl',
        contentHash     CHAR(64)       '$.contentHash',
        embedding       NVARCHAR(MAX)  '$.embedding' AS JSON
    )
) AS source
ON target.slug = source.slug
WHEN MATCHED AND target.contentHash != source.contentHash THEN
    UPDATE SET
        name            = source.name,
        startDate       = source.startDate,
        endDate         = source.endDate,
        locationCity    = source.locationCity,
        locationCountry = source.locationCountry,
        isVirtual       = source.isVirtual,
        topics          = source.topics,
        description     = source.description,
        cfpOpenDate     = source.cfpOpenDate,
        cfpCloseDate    = source.cfpCloseDate,
        cfpUrl          = source.cfpUrl,
        contentHash     = source.contentHash,
        embedding       = CASE
            WHEN source.embedding IS NOT NULL
            THEN CAST(source.embedding AS VECTOR(768))
            ELSE target.embedding
        END,
        updatedAt       = SYSDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (
        id, slug, name, startDate, endDate,
        locationCity, locationCountry, isVirtual,
        topics, description,
        cfpOpenDate, cfpCloseDate, cfpUrl,
        contentHash, embedding, ingestedAt, updatedAt
    )
    VALUES (
        LOWER(CONVERT(NVARCHAR(36), NEWID())),
        source.slug, source.name, source.startDate, source.endDate,
        source.locationCity, source.locationCountry, source.isVirtual,
        source.topics, source.description,
        source.cfpOpenDate, source.cfpCloseDate, source.cfpUrl,
        source.contentHash,
        CASE
            WHEN source.embedding IS NOT NULL
            THEN CAST(source.embedding AS VECTOR(768))
            ELSE NULL
        END,
        SYSDATETIME(),
        SYSDATETIME()
    );
