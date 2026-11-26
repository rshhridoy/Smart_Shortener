import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function RedirectPage() {
  const { slug } = useParams();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function resolveLink() {
      const referrer = document.referrer || 'Direct';
      const deviceType = /mobile|android|iphone/i.test(navigator.userAgent)
        ? 'Mobile'
        : 'Desktop';

      const { data: destinationUrl, error } = await supabase.rpc(
        'resolve_and_track_link',
        {
          p_slug: slug,
          p_referrer: referrer,
          p_device_type: deviceType,
        }
      );

      if (error || !destinationUrl) {
        setNotFound(true);
        return;
      }

      window.location.replace(destinationUrl);
    }

    resolveLink();
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Link Not Found or Inactive</h1>
        <p className="text-sm text-slate-500 mb-6">
          This short link does not exist, has expired, or was paused by its owner.
        </p>
        <Link
          to="/"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          Go to SnapLink Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
      Redirecting to destination...
    </div>
  );
}
