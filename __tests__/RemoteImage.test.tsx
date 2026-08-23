import React from 'react';
import { Image } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import PlaceholderImage from '@/components/PlaceholderImage';
import RemoteImage from '@/components/RemoteImage';

const create = (element: React.ReactElement) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
};

describe('RemoteImage', () => {
  it('renders the hatched placeholder when no image is provided', () => {
    const renderer = create(
      <RemoteImage height={100} placeholderLabel="hero placeholder" />,
    );
    expect(renderer.root.findByType(PlaceholderImage).props.label).toBe(
      'hero placeholder',
    );
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
  });

  it('shows the placeholder while loading, then only the image', () => {
    const renderer = create(
      <RemoteImage
        image={{ url: 'https://cdn.example/img.webp', caption: 'crosswalk' }}
        height={100}
        placeholderLabel="fallback"
      />,
    );
    const image = renderer.root.findByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://cdn.example/img.webp' });
    // Still loading → caption-labelled placeholder behind the image.
    expect(renderer.root.findByType(PlaceholderImage).props.label).toBe(
      'crosswalk',
    );

    ReactTestRenderer.act(() => {
      image.props.onLoad();
    });
    expect(renderer.root.findAllByType(PlaceholderImage)).toHaveLength(0);
    expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  });

  it('falls back to the placeholder on a broken URL', () => {
    const renderer = create(
      <RemoteImage
        image={{ url: 'https://cdn.example/broken.webp' }}
        height={100}
        placeholderLabel="fallback"
      />,
    );
    ReactTestRenderer.act(() => {
      renderer.root.findByType(Image).props.onError();
    });
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findByType(PlaceholderImage).props.label).toBe(
      'fallback',
    );
  });
});
