import type { ComponentProps } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type AppLinkProps = Omit<ComponentProps<typeof RouterLink>, 'to'> & {
  href?: ComponentProps<typeof RouterLink>['to'];
  to?: ComponentProps<typeof RouterLink>['to'];
};

export default function AppLink({ href, to, ...props }: AppLinkProps) {
  return <RouterLink to={to ?? href ?? '#'} {...props} />;
}
