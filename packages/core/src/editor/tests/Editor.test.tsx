import { ERROR_RESOLVER_NOT_AN_OBJECT } from '@noahbaron91/utils';
import { shallow } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { Events } from '../../events';
import { Editor } from '../Editor';
import { EditorContext } from '../EditorContext';
import { useEditorStore } from '../store';

jest.mock('../store');
const mockStore = useEditorStore as jest.Mock<any>;

describe('<Editor />', () => {
  const children = <h1>a children</h1>;
  let component;
  let onNodesChange;

  beforeEach(() => {
    React.useEffect = (f) => f();

    onNodesChange = jest.fn();

    // TODO: refactor this mock
    const mockedStore = {
      actions: {
        setOptions: jest.fn(),
      },
      query: { serialize: jest.fn().mockImplementation(() => '{}') },
      subscribe: jest.fn(),
    };

    mockStore.mockImplementation((value) => ({ ...value, ...mockedStore }));

    act(() => {
      component = shallow(
        <Editor onNodesChange={onNodesChange}>{children}</Editor>
      );
    });
  });
  it('should render the children with events', () => {
    expect(component.contains(<Events>{children}</Events>)).toBe(true);
  });
  it('should render the EditorContext.Provider', () => {
    expect(component.find(EditorContext.Provider)).toHaveLength(1);
  });

  it('should throw an error when resolver is not an object', () => {
    expect(() => {
      // @ts-ignore
      shallow(<Editor resolver={[]} />);
    }).toThrowError(ERROR_RESOLVER_NOT_AN_OBJECT);
  });
  // TODO: use react-testing-library to test hook-related code
});
