/**
 * OMDB falsa para los tests e2e: sustituye a `fetch` y responde como la API real
 * (búsqueda con `s` y detalle con `i`), con un catálogo fijo.
 * Así los tests no gastan peticiones de la API key ni dependen de internet,
 * y services/omdb.service.js se prueba entero (incluida la conversión al formato común).
 */

const CATALOG = [
    {
        imdbID: "tt0133093",
        Title: "The Matrix",
        Year: "1999",
        Poster: "https://example.com/matrix.jpg",
        Director: "Lana Wachowski, Lilly Wachowski",
        Genre: "Action, Sci-Fi",
        Runtime: "136 min",
        Plot: "Un hacker descubre que el mundo en el que vive es una simulación.",
        Actors: "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss",
        imdbRating: "8.7"
    },
    {
        imdbID: "tt0234215",
        Title: "The Matrix Reloaded",
        Year: "2003",
        Poster: "N/A",
        Director: "Lana Wachowski, Lilly Wachowski",
        Genre: "Action, Sci-Fi",
        Runtime: "138 min",
        Plot: "Neo y sus aliados defienden Zion de las máquinas.",
        Actors: "Keanu Reeves, Laurence Fishburne",
        imdbRating: "7.2"
    }
];

const NOT_FOUND = { Response: "False", Error: "Movie not found!" };

/** Respuesta mínima compatible con la de `fetch` (lo que usa omdb.service.js). */
const jsonResponse = (data) => ({ ok: true, status: 200, json: async () => data });

/**
 * Sustituto de `fetch` que solo conoce las URLs de OMDB.
 * @param {string|URL} url
 */
const fakeOmdbFetch = async (url) => {
    const { hostname, searchParams } = new URL(String(url));
    if (hostname !== "www.omdbapi.com") {
        throw new Error(`fetch no esperado en los tests e2e: ${url}`);
    }

    const search = searchParams.get("s");
    if (search) {
        const found = CATALOG.filter((m) => m.Title.toLowerCase().includes(search.toLowerCase()));
        return jsonResponse(found.length
            ? {
                Response: "True",
                totalResults: String(found.length),
                Search: found.map(({ imdbID, Title, Year, Poster }) => ({ imdbID, Title, Year, Poster, Type: "movie" }))
            }
            : NOT_FOUND);
    }

    const movie = CATALOG.find((m) => m.imdbID === searchParams.get("i"));
    return jsonResponse(movie ? { ...movie, Response: "True" } : { Response: "False", Error: "Incorrect IMDb ID." });
};

module.exports = { fakeOmdbFetch, CATALOG };
