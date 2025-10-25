import classnames from "classnames";
import React, { useState, useRef, useEffect } from "react";

import styles from "./index.module.scss";
import { Popconfirm } from "antd";

export interface FileNameItemProps {
  value: string; //文件名
  actived: boolean; //是否选中
  creating: boolean; //是否创建
  readonly: boolean; //只读
  onEditComplete: (name: string) => void; //处理编辑完成
  onRemove: () => void; //处理删除
  onClick: () => void; //处理点击
}

export const FileNameItem: React.FC<FileNameItemProps> = (props) => {
  const {
    value,
    actived = false,
    readonly,
    creating,
    onClick,
    onRemove,
    onEditComplete, //处理编辑完成
  } = props;

  const [name, setName] = useState(value);
  const [editing, setEditing] = useState(creating);
  const inputRef = useRef<HTMLInputElement>(null); //输入框引用

  //双击编辑
  const handleDoubleClick = () => {
    setEditing(true);
    //设置输入框聚焦（使用 setTimeout 确保DOM更新后再聚焦）
    setTimeout(() => {
      inputRef?.current?.focus();
    }, 0);
  };

  //创建状态变化时，设置输入框聚焦
  useEffect(() => {
    if (creating) {
      inputRef?.current?.focus();
    }
  }, [creating]);

  // 输入框失去焦点完成编辑
  const hanldeInputBlur = () => {
    setEditing(false);
    onEditComplete(name);
  };

  return (
    <div
      className={classnames(
        styles["tab-item"],
        actived ? styles.actived : null
      )}
      onClick={onClick}
    >
      {editing ? (
        //编辑模式：显示输入框
        <input
          ref={inputRef}
          className={styles["tabs-item-input"]}
          value={name}
          onBlur={hanldeInputBlur}
          onChange={(e) => setName(e.target.value)}
        />
      ) : (
        //查看模式：显示文件名和删除按钮
        <>
          <span onDoubleClick={!readonly ? handleDoubleClick : () => {}}>
            {name}
          </span>
          {!readonly ? (
            <Popconfirm
              title="确认删除该文件吗？"
              okText="确定"
              cancelText="取消"
              onConfirm={(e) => {
                e?.stopPropagation(); //阻止事件冒泡
                onRemove();
              }}
            >
              <span style={{ marginLeft: 5, display: "flex" }}>
                {/* 删除图标(一个对角线) */}
                <svg width="12" height="12" viewBox="0 0 24 24">
                  <line stroke="#999" x1="18" y1="6" x2="6" y2="18"></line>
                  <line stroke="#999" x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </span>
            </Popconfirm>
          ) : null}
        </>
      )}
    </div>
  );
};
