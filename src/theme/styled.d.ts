import 'styled-components';
import 'styled-components/native';

import type { AppTheme } from './index';

// styled-components/native ships its own copy of the typings, so DefaultTheme
// has to be augmented on both module paths. Declaration merging requires
// interfaces here.
declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}

declare module 'styled-components/native' {
  export interface DefaultTheme extends AppTheme {}
}
