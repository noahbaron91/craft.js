// import { ROOT_NODE } from '@noahbaron91/utils';

// import getAscendingColumns from './getAscendingColumns';
// import getAscendingRows from './getAscendingRows';
// import getBreakpointWidth from './getBreakpointWidth';
// import getHeightPercentage from './getHeightPercentage';
// import getWidthPercentage from './getWidthPercentage';

// const getAscendingColumns = (
//   page: Page,
//   id: string,
//   breakpoint: DisplayWidth
// ) => {
//   const gridColumnElements: number[] = [];

//   const element = page[id];
//   const childrenNodes = element.nodes;

//   childrenNodes.forEach((id) => {
//     let childElement = page[id];
//     if (!childElement) return;

//     const breakpointNodes = childElement.breakpointNodes;
//     switch (breakpoint) {
//       case 'desktop': {
//         break;
//       }
//       case 'tablet': {
//         childElement = page[breakpointNodes['TABLET']];
//         break;
//       }
//       case 'mobile': {
//         childElement = page[breakpointNodes['MOBILE']];
//       }
//     }

//     const { left } = childElement.position;
//     const widthPercentage = getWidthPercentage({
//       childElement,
//       breakpoint,
//       page,
//     });

//     const columnWidth = left + widthPercentage;
//     gridColumnElements.push(...[columnWidth, left]);
//   });

//   // Arrange in ascending order
//   gridColumnElements.sort((a, b) => a - b);

//   return gridColumnElements;
// };

// const getAscendingRows = (page: Page, id: string, breakpoint: "desktop" ) => {
//   const childrenNodes = page[id].nodes;
//   const gridRowElements: { height: number; isText: boolean }[] = [];

//   const breakpointWidth = getBreakpointWidth(breakpoint);

//   childrenNodes.forEach((id) => {
//     let childElement = page[id];
//     if (!childElement) return;

//     const breakpointNodes = childElement.breakpointNodes;

//     switch (breakpoint) {
//       case 'desktop': {
//         break;
//       }
//       case 'tablet': {
//         childElement = page[breakpointNodes['TABLET']];
//         break;
//       }
//       case 'mobile': {
//         childElement = page[breakpointNodes['MOBILE']];
//       }
//     }

//     const { top } = childElement.position;

//     const displayName = childElement.displayName;
//     const heightValue = getHeightPercentage({ childElement, breakpoint, page });
//     const columnHeight = (top / breakpointWidth) * 100 + heightValue;

//     gridRowElements.push(
//       ...[
//         { height: columnHeight, isText: displayName === 'Text' },
//         { height: (top / breakpointWidth) * 100, isText: false },
//       ]
//     );
//   });

//   // Arrange in ascending order
//   gridRowElements.sort((a, b) => a.height - b.height);

//   return gridRowElements;
// };

// export const generateGridArea = (
//   page: Page,
//   id: string,
//   breakpoint: DisplayWidth
// ) => {
//   let element = page[id];
//   if (!element) return '';

//   const parent = element.parent;
//   const breakpointNodes = element.breakpointNodes;

//   switch (breakpoint) {
//     case 'desktop': {
//       break;
//     }
//     case 'tablet': {
//       element = page[breakpointNodes['TABLET']];
//       break;
//     }
//     case 'mobile': {
//       element = page[breakpointNodes['MOBILE']];
//     }
//   }

//   if (!parent || parent === ROOT_NODE) return '';

//   const breakpointWidth = getBreakpointWidth(breakpoint);

//   const columnElements = getAscendingColumns(page, parent, breakpoint);
//   const rowElements = getAscendingRows(page, parent, breakpoint);

//   const width = getWidthPercentage({ childElement: element, breakpoint, page });
//   const height = getHeightPercentage({
//     childElement: element,
//     breakpoint,
//     page,
//   });

//   const { left, top } = element.position;

//   // Starts from element AFTER the spacing
//   const initialColumnIndex =
//     columnElements.findIndex((columnElement) => columnElement === left) + 1;
//   const finalColumnIndex =
//     columnElements.findIndex(
//       (columnElement) => columnElement === left + width
//     ) + 1;

//   const initialRowIndex =
//     rowElements.findIndex(
//       (columnElement) => columnElement.height === (top / breakpointWidth) * 100
//     ) + 1;

//   const finalRowIndex =
//     rowElements.findIndex((columnElement) => {
//       return columnElement.height === (top / breakpointWidth) * 100 + height;
//     }) + 1;

//   // Grid columns count from 1 not 0
//   const gridColumnStart = initialColumnIndex + 1;
//   const gridColumnEnd = finalColumnIndex + 1;

//   const gridRowStart = initialRowIndex + 1;
//   const gridRowEnd = finalRowIndex + 1;

//   const gridArea = `${gridRowStart} / ${gridColumnStart} / ${gridRowEnd} / ${gridColumnEnd}`;

//   return gridArea;
// };

// export default generateGridArea;

export default null;
