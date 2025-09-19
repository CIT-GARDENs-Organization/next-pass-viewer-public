import { getPasses } from '../../../lib/passes';

function resolveStandardTime(startTimeParam: string | null): Date {
  if (!startTimeParam) {
    return new Date();
  }

  const parsedTime = new Date(startTimeParam);
  if (Number.isNaN(parsedTime.getTime())) {
    return new Date();
  }

  return parsedTime;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const satelliteNames = url.searchParams.getAll('satellite').filter(Boolean);
  const viewLength = Math.max(parseInt(url.searchParams.get('view') || '2', 10), 1);
  const startTimeParam = url.searchParams.get('start_time');

  const standardTime = resolveStandardTime(startTimeParam);

  try {
    const { data, source } = await getPasses({
      standardTime,
      viewLength,
      satelliteNames,
    });

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'X-Pass-Source': source,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
