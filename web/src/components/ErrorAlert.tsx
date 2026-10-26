import { Link } from 'react-router-dom';
import { ApiError, errorMessage } from '../lib/api';
import { Alert } from './ui';

/** Error message; plan-limit errors get an upgrade link. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const upgrade = error instanceof ApiError && (error.code === 'limit_reached' || error.code === 'pro_required');
  return (
    <Alert tone={upgrade ? 'warning' : 'error'}>
      {errorMessage(error)}
      {upgrade && (
        <>
          {' '}
          <Link to="/billing" className="font-semibold underline">
            See Pro plans
          </Link>
        </>
      )}
    </Alert>
  );
}
