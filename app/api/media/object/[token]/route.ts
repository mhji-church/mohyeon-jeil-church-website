import { externalMediaKey } from "../../../../../lib/media-path";
import { serveExternalMedia } from "../../route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return serveExternalMedia(externalMediaKey(token));
}
