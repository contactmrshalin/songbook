import { deleteFiles, getFileContent, commitFiles, listRepoDir } from "@/lib/github";

// Not force-dynamic for static export compatibility

/**
 * POST /api/admin/delete
 * Body: { songId: string, password: string, deleteImage?: boolean }
 *
 * Deletes a song from the GitHub repo in a single atomic commit:
 *  1. Removes data/songs/<id>.json
 *  2. Removes from data/book.json song_order
 *  3. Optionally removes the image from data/images/
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId, password, deleteImage = true } = body as {
      songId?: string;
      password?: string;
      deleteImage?: boolean;
    };

    // Auth check
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!songId || typeof songId !== "string") {
      return Response.json(
        { error: "Missing required field: songId" },
        { status: 400 }
      );
    }

    // Get the song title for the commit message
    const songRaw = await getFileContent(`data/songs/${songId}.json`);
    const songTitle = songRaw
      ? JSON.parse(songRaw).title || songId
      : songId;

    // Collect paths to delete
    const pathsToDelete: string[] = [`data/songs/${songId}.json`];

    // Find and delete associated image(s) if requested
    if (deleteImage) {
      const imageFiles = await listRepoDir("data/images");
      if (imageFiles) {
        for (const file of imageFiles) {
          // Match any extension: song-id.png, song-id.jpg, etc.
          const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
          if (nameWithoutExt === songId) {
            pathsToDelete.push(file.path);
          }
        }
      }
    }

    // Update book.json — remove song from song_order
    const bookRaw = await getFileContent("data/book.json");
    let bookUpdated = false;
    if (bookRaw) {
      const book = JSON.parse(bookRaw);
      const order: string[] = book.song_order || [];
      const idx = order.indexOf(songId);
      if (idx !== -1) {
        order.splice(idx, 1);
        book.song_order = order;
        bookUpdated = true;
      }
    }

    // We need to do both deletes and updates in one commit.
    // Strategy: use deleteFiles for the removals, then a separate
    // commitFiles for book.json update. BUT that's 2 commits again.
    //
    // Better: build the full tree manually. deleteFiles + modified files
    // can go in one tree if we combine them. Let's do it via the
    // low-level approach — delete song/image via null sha, update book.json
    // via new blob — all in one tree + one commit.

    // We'll handle this by doing: first delete the files, then immediately
    // after update book.json. Since both need to be atomic, let's extend
    // our approach — use commitFiles for book.json, and include delete
    // entries in the same tree.

    // Actually, the cleanest way: build the commit manually here.
    const commitMessage = `delete song: ${songTitle}`;

    if (bookUpdated && bookRaw) {
      // We need to do deletes + book.json update in one commit.
      // Use the low-level Git Data API directly.
      const result = await deleteAndUpdateCommit(
        pathsToDelete,
        JSON.parse(bookRaw),
        songId,
        commitMessage
      );
      if (!result.success) {
        return Response.json(
          { error: `GitHub commit failed: ${result.error}` },
          { status: 500 }
        );
      }
      return Response.json({
        success: true,
        commitSha: result.commitSha,
        songId,
        deletedFiles: pathsToDelete,
        message: `Deleted "${songTitle}" — deployments will trigger automatically.`,
      });
    }

    // No book.json update needed — just delete the files
    const result = await deleteFiles(pathsToDelete, commitMessage);

    if (!result.success) {
      return Response.json(
        { error: `GitHub commit failed: ${result.error}` },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      commitSha: result.commitSha,
      songId,
      deletedFiles: pathsToDelete,
      message: `Deleted "${songTitle}" — deployments will trigger automatically.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Atomic commit that both deletes files AND updates book.json.
 */
async function deleteAndUpdateCommit(
  deletePaths: string[],
  book: Record<string, unknown>,
  songId: string,
  message: string
): Promise<{ success: boolean; commitSha?: string; error?: string }> {
  // Remove song from order
  const order = (book.song_order as string[]) || [];
  const idx = order.indexOf(songId);
  if (idx !== -1) order.splice(idx, 1);
  book.song_order = order;

  // Use commitFiles for the book.json update, but we also need deletions.
  // Combine: create the updated book.json blob + delete entries in one tree.
  const updatedBookJson = JSON.stringify(book, null, 2) + "\n";

  // Build combined file list: book.json as an update, song/images as deletes
  const filesToCommit = [
    { path: "data/book.json", content: updatedBookJson },
  ];

  // For the delete, we need to also pass delete entries. But commitFiles
  // only handles additions. So let's use a combined approach with
  // deleteFiles-style null sha entries alongside normal blob entries.

  // Import the internal helpers by duplicating the logic here:
  const GITHUB_API = "https://api.github.com";
  const REPO_OWNER = "contactmrshalin";
  const REPO_NAME = "songbook";
  const BRANCH = "main";

  const token = process.env.GITHUB_TOKEN;
  if (!token) return { success: false, error: "GITHUB_TOKEN not set" };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  // 1. Get latest commit
  const refRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
    { headers }
  );
  if (!refRes.ok) return { success: false, error: `Failed to get ref: ${refRes.status}` };
  const refData = await refRes.json();
  const latestSha = refData.object.sha;

  // 2. Get base tree
  const commitRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${latestSha}`,
    { headers }
  );
  if (!commitRes.ok) return { success: false, error: `Failed to get commit` };
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blob for updated book.json
  const blobRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ content: updatedBookJson, encoding: "utf-8" }),
    }
  );
  if (!blobRes.ok) return { success: false, error: "Failed to create book.json blob" };
  const blobData = await blobRes.json();

  // 4. Build tree: book.json update + file deletions (sha: null)
  const treeEntries: Record<string, unknown>[] = [
    { path: "data/book.json", mode: "100644", type: "blob", sha: blobData.sha },
    ...deletePaths.map((p) => ({
      path: p,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const treeRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    }
  );
  if (!treeRes.ok) return { success: false, error: `Failed to create tree: ${treeRes.status}` };
  const treeData = await treeRes.json();

  // 5. Create commit
  const newCommitRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [latestSha],
      }),
    }
  );
  if (!newCommitRes.ok) return { success: false, error: "Failed to create commit" };
  const newCommitData = await newCommitRes.json();

  // 6. Update branch ref
  const updateRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitData.sha }),
    }
  );
  if (!updateRes.ok) return { success: false, error: "Failed to update branch" };

  return { success: true, commitSha: newCommitData.sha };
}
