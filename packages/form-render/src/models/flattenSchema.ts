

import { _cloneDeep, isObjType, isListType } from '../utils/index';

export function orderProperties(properties, orderKey = 'order') {
  const orderHash = new Map();
  // order不为数字的数据
  const unsortedList = [];
  const insert = item => {
    const [, value] = item;
    if (typeof value[orderKey] !== 'number') {
      unsortedList.push(item);
      return;
    }
    if (orderHash.has(value[orderKey])) {
      orderHash.get(value[orderKey]).push(item);
    } else {
      orderHash.set(value[orderKey], [item]);
    }
  };

  properties.forEach(item => insert(item));
  const sortedList = Array.from(orderHash.entries())
    .sort(([order1], [order2]) => order1 - order2) // order值越小越靠前
    .flatMap(([, items]) => items);
  return sortedList.concat(unsortedList);
}

export const getKeyFromPath = (path = '#') => {
  try {
    const arr = path.split('.');
    const last = arr.slice(-1)[0];
    const result = last.replace('[]', '');
    return result;
  } catch (error) {
    console.error(error, 'getKeyFromPath');
    return '';
  }
};

export function getSchemaFromFlatten(flatten, path = '#') {
  let schema: any = {};
  const item = _cloneDeep(flatten[path]);
  if (item) {
    schema = item.schema;
    // schema.$id && delete schema.$id;
    if (item.children.length > 0) {
      item.children.forEach(child => {
        if (!flatten[child]) return;
        const key = getKeyFromPath(child);
        if (isObjType(schema)) {
          schema.properties[key] = getSchemaFromFlatten(flatten, child);
        }
        if (isListType(schema)) {
          schema.items.properties[key] = getSchemaFromFlatten(flatten, child);
        }
      });
    }
  }
  return schema;
}

// TODO: more tests to make sure weird & wrong schema won't crush
export function flattenSchema(_schema = {}, name?: any, parent?: any, _result?: any) {
  // 排序
  // _schema = orderBy(_schema, item => item.order, ['asc']);

  const result = _result || {};

  const schema: any = _cloneDeep(_schema) || {};
  let _name = name || '#';
  if (!schema.$id) {
    schema.$id = _name; // path as $id, for easy access to path in schema
  }
  const children = [];
  if (isObjType(schema)) {
    orderProperties(Object.entries(schema.properties)).forEach(
      ([key, value]) => {
        const _key = isListType(value) ? key + '[]' : key;
        const uniqueName = _name === '#' ? _key : _name + '.' + _key;
        children.push(uniqueName);

        flattenSchema(value, uniqueName, _name, result);
      }
    );

    schema.properties = {};
  }
  if (isListType(schema)) {
    orderProperties(Object.entries(schema.items.properties)).forEach(
      ([key, value]) => {
        const _key = isListType(value) ? key + '[]' : key;
        const uniqueName = _name === '#' ? _key : _name + '.' + _key;
        children.push(uniqueName);
        flattenSchema(value, uniqueName, _name, result);
      }
    );

    schema.items.properties = {};
  }

  if (schema.type) {
    result[_name] = { parent, schema, children };
  }
 
  return result;
}

