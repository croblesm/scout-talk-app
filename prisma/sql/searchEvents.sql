-- @param {String} $1:queryEmbedding A JSON array of 768 floats, e.g. "[0.1, -0.2, ...]"
-- @param {Int}    $2:limit          The maximum number of results to return.
SELECT TOP (@P2)
    id,
    slug,
    name,
    startDate,
    endDate,
    locationCity,
    locationCountry,
    isVirtual,
    topics,
    description,
    cfpOpenDate,
    cfpCloseDate,
    cfpUrl,
    1.0 - VECTOR_DISTANCE('cosine', embedding, CAST(@P1 AS VECTOR(768))) AS similarity
FROM Event
WHERE embedding IS NOT NULL
ORDER BY similarity DESC;
