import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

type ThemeValue = ReturnType<typeof useTheme>;

function captureTheme(onValue: (v: ThemeValue) => void) {
  function Probe() {
    onValue(useTheme());
    return null;
  }
  return (
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );
}

describe('ThemeContext', () => {
  it('starts in light mode', () => {
    let value!: ThemeValue;
    act(() => {
      TestRenderer.create(captureTheme(v => { value = v; }));
    });
    expect(value.isDark).toBe(false);
    expect(value.colors.background).toBe('#F8F9FF');
  });

  it('toggleDark switches to dark mode colors', () => {
    let value!: ThemeValue;
    act(() => {
      TestRenderer.create(captureTheme(v => { value = v; }));
    });
    act(() => { value.toggleDark(); });
    expect(value.isDark).toBe(true);
    expect(value.colors.background).toBe('#0A0A0F');
    expect(value.colors.surface).toBe('#13131A');
  });

  it('toggleDark twice returns to light mode', () => {
    let value!: ThemeValue;
    act(() => {
      TestRenderer.create(captureTheme(v => { value = v; }));
    });
    act(() => { value.toggleDark(); });
    act(() => { value.toggleDark(); });
    expect(value.isDark).toBe(false);
  });

  it('throws when useTheme is used outside ThemeProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useTheme();
      return null;
    }
    expect(() => {
      act(() => { TestRenderer.create(<Bare />); });
    }).toThrow('useTheme must be used inside ThemeProvider');
    consoleError.mockRestore();
  });
});
