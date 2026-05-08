BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Event] (
    [id] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [locationCity] NVARCHAR(1000),
    [locationCountry] NVARCHAR(1000),
    [isVirtual] BIT NOT NULL CONSTRAINT [Event_isVirtual_df] DEFAULT 0,
    [topics] NVARCHAR(max) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [cfpOpenDate] DATETIME2,
    [cfpCloseDate] DATETIME2,
    [cfpUrl] NVARCHAR(1000),
    [contentHash] CHAR(64) NOT NULL,
    [embedding] VECTOR(768),
    [ingestedAt] DATETIME2 NOT NULL CONSTRAINT [Event_ingestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Event_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Event_slug_key] UNIQUE NONCLUSTERED ([slug])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
