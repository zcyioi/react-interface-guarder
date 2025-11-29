import { AttributeValueType, DeclarationType, DeclarationTypeKey, KeyWord, AttributeValue, SchemaPropertyType } from "./const";

type GuarderType = Record<string, SchemaPropertyType>;

const getLastAttribute = (schemaProperty: SchemaPropertyType): AttributeValue | undefined => {
  return schemaProperty.attribute[schemaProperty.attribute.length - 1];
};

const applySchemaGuard = ({
  target,
  targetSchema,
  isArray = false,
  visited = new WeakSet(),
}: {
  target: any;
  targetSchema: GuarderType;
  isArray?: boolean;
  visited?: WeakSet<object>;
}) => {
  if (isArray) return [];
  const entries = Object.entries(targetSchema);

  const declarationType = (targetSchema as Record<string, any>)[DeclarationTypeKey];
  if (declarationType === DeclarationType.TypeAliasDeclaration) {
    const [, schemaProperty] = entries[0];
    target = autoFillValue(schemaProperty, visited);
    return target;
  }

  for (const [key, schemaProperty] of entries) {
    if (key in target) {
      target[key] = verifyAndFillField(target[key], schemaProperty, visited);
    } else {
      const attribute = getLastAttribute(schemaProperty);
      if (!attribute) continue;
      if (visited.has(attribute.value)) {
        target[key] = {};
        return target;
      }
      if (
        attribute.valueType === AttributeValueType.TypeLiteral ||
        attribute.valueType === AttributeValueType.TypeReference
      ) {
        visited.add(attribute.value);
      }
      target[key] = autoFillValue(schemaProperty, visited);
    }
  }

  return target;
};

const autoFillValue = (schemaProperty: SchemaPropertyType, visited: WeakSet<object>) => {
  const attribute = getLastAttribute(schemaProperty);
  if (!attribute) return null;
  if (attribute.isArray) {
    return [];
  }
  let value: any;
  switch (attribute.valueType) {
    case AttributeValueType.BaseType:
      value = fillBaseType(attribute.value);
      break;
    case AttributeValueType.Alias:
      value = fillAliasType(attribute.value);
      break;
    case AttributeValueType.TypeLiteral:
      value = fillTypeLiteral(attribute, visited);
      break;
    case AttributeValueType.TypeReference:
      value = fillTypeReference(attribute, visited);
      break;
    default:
      value = null;
  }
  return value;
};

const fillBaseType = (baseValue: string) => {
  switch (baseValue) {
    case KeyWord.StringKeyword:
      return "";
    case KeyWord.NumberKeyword:
      return 0;
    case KeyWord.BooleanKeyword:
      return false;
    case KeyWord.UndefinedKeyword:
      return undefined;
    case KeyWord.NullKeyword:
      return null;
    default: {
      return null;
    }
  }
};

const fillAliasType = (baseValue: any): any => {
  return baseValue;
};

const fillTypeLiteral = (attribute: any, visited: WeakSet<object>): any => {
  const obj: Record<string, unknown> = {};
  applySchemaGuard({
    target: obj,
    targetSchema: attribute.value as GuarderType,
    isArray: attribute.isArray,
    visited,
  });
  return obj;
};

const fillTypeReference = (attribute: any, visited: WeakSet<object>): any => {
  let obj: Record<string, unknown> = {};
  obj = applySchemaGuard({
    target: obj,
    targetSchema: attribute.value as GuarderType,
    isArray: attribute.isArray,
    visited,
  });
  return obj;
};

const verifyAndFillField = (
  target: any,
  propertyScheme: SchemaPropertyType,
  visited: WeakSet<object>,
) => {
  let newParam = target;
  let verifyFlag = false;
  verIfyFieldsOuter: for (const item of propertyScheme.attribute) {
    switch (item.valueType) {
      case AttributeValueType.BaseType: {
        const { isVerify, value } = checkBaseType(target, item.isArray ?? false, item.value);
        if (isVerify) {
          verifyFlag = true;
          newParam = value;
          break verIfyFieldsOuter;
        }
        break;
      }
      case AttributeValueType.Alias: {
        const { isVerify, value } = checkAliasType(target, item.isArray ?? false, item.value);
        if (isVerify) {
          verifyFlag = true;
          newParam = value;
          break verIfyFieldsOuter;
        }
        break;
      }
      case AttributeValueType.TypeLiteral: {
        const { isVerify, value } = checkTypeLiteral(target, item.isArray ?? false, item.value);
        if (isVerify) {
          verifyFlag = true;
          newParam = value;
        }
        break;
      }
      case AttributeValueType.TypeReference: {
        const { isVerify, value } = checkTypeReference(target, item.isArray ?? false, item.value);
        if (isVerify) {
          verifyFlag = true;
          newParam = value;
        }
        break;
      }
    }
  }
  if (!verifyFlag) {
    newParam = autoFillValue(propertyScheme, visited);
  }
  return newParam;
};

const checkBaseType = (paramValue: any, isArray: boolean, value: any): { isVerify: boolean; value: any } => {
  const paramValueType = typeof paramValue;
  if (isArray && Array.isArray(paramValue)) {
    return { isVerify: true, value: paramValue };
  }
  switch (value) {
    case KeyWord.StringKeyword:
      if (paramValueType === "string") {
        return { isVerify: true, value: paramValue };
      }
      break;
    case KeyWord.NumberKeyword:
      if (paramValueType === "number") {
        return { isVerify: true, value: paramValue };
      }
      break;
    case KeyWord.BooleanKeyword:
      if (paramValueType === "boolean") {
        return { isVerify: true, value: paramValue };
      }
      break;
    case KeyWord.UndefinedKeyword:
      if (paramValueType === "undefined") {
        return { isVerify: true, value: paramValue };
      }
      break;
    case KeyWord.NullKeyword:
      if (paramValue === null) {
        return { isVerify: true, value: paramValue };
      }
      break;
    default: {
      return { isVerify: false, value: paramValue };
    }
  }
  return { isVerify: false, value: paramValue };
};

const checkAliasType = (paramValue: any, isArray: boolean, value: any) => {
  if (isArray && Array.isArray(paramValue)) {
    return { isVerify: true, value: paramValue };
  }
  if (paramValue === value) {
    return { isVerify: true, value: paramValue };
  }
  return { isVerify: false, value };
};

const checkTypeLiteral = (paramValue: any, isArray: boolean, value: GuarderType) => {
  if (isArray && Array.isArray(paramValue)) {
    paramValue.forEach((item) => {
      applySchemaGuard({ target: item, targetSchema: value });
    });
  } else {
    applySchemaGuard({ target: paramValue, targetSchema: value });
  }
  return { isVerify: true, value: paramValue };
};

const checkTypeReference = (paramValue: any, isArray: boolean, value: GuarderType) => {
  if (isArray && Array.isArray(paramValue)) {
    paramValue.forEach((item) => {
      applySchemaGuard({ target: item, targetSchema: value });
    });
  } else {
    applySchemaGuard({ target: paramValue, targetSchema: value });
  }
  return { isVerify: true, value: paramValue };
};

export default applySchemaGuard;
