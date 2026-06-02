import React from 'react';
import { render } from '@testing-library/react-native';
import { AppText } from '../src/components/AppText';
import { ColourfulClockProvider } from '../src/theme/ColourfulClockContext';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ColourfulClockProvider>{children}</ColourfulClockProvider>;
}

describe('AppText', () => {
  it('renders string children as individual characters', () => {
    const { getAllByText } = render(
      <Wrapper>
        <AppText>Hi</AppText>
      </Wrapper>
    );
    expect(getAllByText('H')).toHaveLength(1);
    expect(getAllByText('i')).toHaveLength(1);
  });

  it('renders number children as string characters', () => {
    const { getAllByText } = render(
      <Wrapper>
        <AppText>{42}</AppText>
      </Wrapper>
    );
    expect(getAllByText('4')).toHaveLength(1);
    expect(getAllByText('2')).toHaveLength(1);
  });

  it('passes numberOfLines through to container', () => {
    const { UNSAFE_getAllByType } = render(
      <Wrapper>
        <AppText numberOfLines={2}>Hello</AppText>
      </Wrapper>
    );
    const { Text } = require('react-native');
    const textNodes = UNSAFE_getAllByType(Text);
    const container = textNodes.find((n: any) => n.props.numberOfLines === 2);
    expect(container).toBeTruthy();
  });
});
