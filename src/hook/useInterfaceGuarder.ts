import {useMemo} from "react";
import type {SchemaPropertyType} from "./const";
import applySchemaGuard from "./SchemeGuard";

type GuarderType = Record<string, SchemaPropertyType>;


export const useInterfaceGuarder = <T extends Record<string, any> | Record<string, any>[]>(
	source: T,
	...args: any[]
): T | T[] => {
	const targetSchema: GuarderType = args[args.length - 2];
	const isArray: boolean = args[args.length - 1];
	// 拷贝入参
	const safeObj = useMemo(() => {
		if (targetSchema === undefined) return source;
		const target = JSON.parse(JSON.stringify(source ?? {})) as T;

		if (isArray && Array.isArray(target)) {
			return target.map((item) => applySchemaGuard({target: item, targetSchema}));
		}
		return applySchemaGuard({target: target, targetSchema});
	}, [source, isArray, targetSchema]);
	return safeObj;
};
