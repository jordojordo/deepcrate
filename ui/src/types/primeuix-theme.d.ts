import type { PaletteDesignToken } from '@primeuix/themes';

import '@primeuix/themes';

declare module '@primeuix/themes/types/base' {
  namespace BaseTokenSections {
    interface Semantic {
      border?: {
        subtle?:   string;
        default?:  string;
        emphasis?: string;
        accent?:   string;
      };
      purple?: PaletteDesignToken;
      green?:  PaletteDesignToken;
      red?:    PaletteDesignToken;
      blue?:   PaletteDesignToken;
      orange?: PaletteDesignToken;
      teal?:   PaletteDesignToken;
      yellow?: PaletteDesignToken;
    }
  }
}
