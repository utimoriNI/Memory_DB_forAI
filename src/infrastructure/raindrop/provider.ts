export interface RaindropSearchResult {
  id: string;
  url: string;
  title: string;
  excerpt?: string;
  tags: string[];
  collection?: string;
}

export interface RaindropBookmark extends RaindropSearchResult {
  createdAt?: string;
  updatedAt?: string;
}

export interface RaindropSearchProvider {
  search(query: string, limit?: number): Promise<RaindropSearchResult[]>;
  getBookmark(id: string): Promise<RaindropBookmark | null>;
}

export class MockRaindropSearchProvider implements RaindropSearchProvider {
  public constructor(private readonly bookmarks: RaindropBookmark[] = []) {}

  public search(query: string, limit = 20): Promise<RaindropSearchResult[]> {
    const text = query.toLowerCase();
    return Promise.resolve(
      this.bookmarks
        .filter((bookmark) =>
          [bookmark.title, bookmark.url, bookmark.excerpt ?? "", ...bookmark.tags]
            .join("\n")
            .toLowerCase()
            .includes(text)
        )
        .slice(0, limit)
    );
  }

  public getBookmark(id: string): Promise<RaindropBookmark | null> {
    return Promise.resolve(this.bookmarks.find((bookmark) => bookmark.id === id) ?? null);
  }
}
