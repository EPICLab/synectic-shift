import React from 'react';
import isUUID from 'validator/lib/isUUID';
import { mount } from 'enzyme';

import { wrapInTestContext } from './__mocks__/dndReduxMock';
import CanvasComponent from '../src/components/CanvasComponent';
import { getMockStore, getCanvasProps } from './__mocks__/reduxStoreMock';
import CardComponent from '../src/components/CardComponent';
import StackComponent from '../src/components/StackComponent';

describe('CanvasComponent', () => {

  const domElement = document.getElementById('app');
  const mountOptions = {
    attachTo: domElement,
  };
  const store = getMockStore();
  const canvasProps = getCanvasProps();

  it('Canvas resolves props into React Components for cards', () => {
    const CanvasContext = wrapInTestContext(CanvasComponent, store);
    const wrapper = mount(<CanvasContext {...canvasProps} />, mountOptions);
    const component = wrapper.find(CanvasComponent).first();
    expect(wrapper.find(CardComponent)).toHaveLength(component.props().cards.length);
  });

  it('Canvas resolves props into React Components for stacks', () => {
    const CanvasContext = wrapInTestContext(CanvasComponent, store);
    const wrapper = mount(<CanvasContext {...canvasProps} />, mountOptions);
    const component = wrapper.find(CanvasComponent).first();
    expect(wrapper.find(StackComponent)).toHaveLength(component.props().stacks.length);
  });

  it('Canvas has a valid UUID when props contain valid UUID', () => {
    const CanvasContext = wrapInTestContext(CanvasComponent, store);
    const wrapper = mount(<CanvasContext {...canvasProps} />, mountOptions);
    const component = wrapper.find(CanvasComponent).first();
    expect(isUUID(component.props().id, 4)).toBe(true);
  });
});