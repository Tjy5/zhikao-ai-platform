export interface TopNavigationLink {
  label: string;
  href: string;
}

interface NavigationLocation {
  pathname: string;
  hash?: string;
}

const retainedRouteTopNavItems = [
  { label: '学习首页', href: '/' },
  { label: '申论学习', href: '/shenlun-study' },
  { label: '申论批改', href: '/writing' },
  { label: '复盘档案', href: '/history' },
  { label: '模型设置', href: '/settings' },
] as const;

export const retainedRouteTopNavLabels = retainedRouteTopNavItems.map(
  item => item.label
);

export const getRetainedRouteTopNavLinks = (
  _pathname = '/'
): TopNavigationLink[] => {
  return retainedRouteTopNavItems.map(item => ({
    label: item.label,
    href: item.href,
  }));
};

const splitHref = (href: string) => {
  if (href.startsWith('#')) {
    return { pathname: '/', hash: href };
  }

  const hashIndex = href.indexOf('#');
  if (hashIndex >= 0) {
    return {
      pathname: href.slice(0, hashIndex) || '/',
      hash: href.slice(hashIndex),
    };
  }

  return { pathname: href, hash: '' };
};

export const isRetainedRouteTopNavLinkActive = (
  href: string,
  location: NavigationLocation
) => {
  const { pathname, hash } = splitHref(href);

  if (hash) {
    return (
      location.pathname === pathname &&
      (location.hash === hash || (hash === '#home' && !location.hash))
    );
  }

  return (
    location.pathname === pathname ||
    (pathname !== '/' && location.pathname.startsWith(`${pathname}/`))
  );
};
