import { ICellHeader } from '@jupyterlab/cells';
import {
  FormComponent,
  IFormComponentProps,
  ReactWidget
} from '@jupyterlab/ui-components';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { SingletonLayout, Widget } from '@lumino/widgets';
import { IChangeEvent } from '@rjsf/core';
import {
  ObjectFieldTemplateProps,
  RJSFSchema,
  ValidatorType
} from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';
import { JSONSchema7 } from 'json-schema';
import React from 'react';

import { ICustomCodeCell, MagicLine } from './common';
import { IDatabasesPanel } from './sidepanel';

/**
 * The class of the header.
 */
const HEADER_CLASS = 'jp-sqlcell-header';

/**
 * A template for React JSON schema form displayed in line.
 */
const inlineObjectTemplate = (props: ObjectFieldTemplateProps) => {
  return (
    <div className="jp-FormWidget-inline">
      {props.title}
      {props.description}
      <div className="form-group">
        {props.properties.map(element => (
          <div className="jp-FormGroup-content">{element.content}</div>
        ))}
      </div>
    </div>
  );
};

/**
 * A react JSON schema form using JupyterLab FormComponent with a dedicated template
 * for inline display.
 */
export const inlineForm = (props: IFormComponentProps): JSX.Element => {
  return (
    <FormComponent
      {...props}
      templates={{
        ObjectFieldTemplate: inlineObjectTemplate as React.FunctionComponent
      }}
    />
  );
};

/**
 * The default schema for the toolbar.
 */
export const defaultSchema = {
  title: 'Sql cell header',
  description: 'A default schema for SQL cell header',
  type: 'object',
  properties: {
    database: {
      type: 'string',
      title: 'Database'
    },
    variable: {
      type: 'string',
      title: 'Variable name'
    }
  },
  dependencies: {
    variable: {
      properties: {
        displayOutput: {
          type: 'boolean'
        }
      }
    }
  }
};

/**
 * The cell header widget.
 */
export class CellHeader extends Widget implements ICellHeader {
  /**
   * Creates a cell header.
   */
  constructor(options: { databasesPanel: IDatabasesPanel }) {
    super();
    this.layout = new SingletonLayout();
    this._databasesPanel = options.databasesPanel;
    this._schema = defaultSchema as JSONSchema7;

    this._rjsfToolbar = ReactWidget.create(this._headerContent());
  }

  /**
   * Initialize the toolbar.
   */
  createToolbar(cell: ICustomCodeCell) {
    this._cell = cell;
    const aliases = this._databasesPanel?.databases.map(
      database => database.alias
    );
    aliases.unshift(' - ');
    if (this._schema.properties?.database !== undefined) {
      this._schema.properties.database.enum = aliases;
    }
    this.update();
  }

  /**
   * Update the form on request.
   */
  protected onUpdateRequest(msg: Message): void {
    const layout = this.layout as SingletonLayout;
    if (this._cell?.isSQL) {
      this.addClass(HEADER_CLASS);
      this._rjsfToolbar = ReactWidget.create(this._headerContent());
      layout.widget = this._rjsfToolbar;
    } else {
      this.removeClass(HEADER_CLASS);
      layout.removeWidget(this._rjsfToolbar);
    }
  }

  /**
   * Triggered when the data changed in form.
   *
   * @param formData - A JSON object representing the current data.
   */
  private _onFormDataChanged = (formData: ReadonlyJSONObject) => {
    const database = this._databasesPanel.get_database(
      formData.database as string
    );
    if (this._cell?.model) {
      if (database) {
        MagicLine.setDatabaseUrl(this._cell.model, database);
      }
      const variable: MagicLine.IVariable = {
        value: formData.variable as string,
        displayOutput: (formData.displayOutput as boolean) || false
      };
      MagicLine.setVariable(this._cell.model, variable);
    }
  };

  /**
   * Build the header content, an inline form.
   */
  private _headerContent = (): JSX.Element => {
    if (!this._cell) {
      return <div>The toolbar has not been created</div>;
    }

    const validator = validatorAjv8 as ValidatorType<
      ReadonlyJSONObject,
      RJSFSchema,
      any
    >;

    const url = MagicLine.getDatabaseUrl(this._cell.model);
    const currentDatabase = this._databasesPanel?.databases.find(
      database => database.url === url
    );

    const currentVariable = MagicLine.getVariable(this._cell.model);

    return inlineForm({
      validator: validator,
      schema: this._schema as JSONSchema7,
      onChange: (e: IChangeEvent<ReadonlyJSONObject>) => {
        this._onFormDataChanged(e.formData || {});
      },
      formData: {
        database: currentDatabase?.alias || ' - ',
        variable: currentVariable.value,
        displayOutput: currentVariable.displayOutput
      }
    });
  };

  /**
   * Triggered before the widget is detached.
   */
  protected onBeforeDetach(msg: Message): void {
    (this.layout as SingletonLayout).removeWidget(this._rjsfToolbar);
  }

  private _cell: ICustomCodeCell | null = null;
  private _databasesPanel: IDatabasesPanel;
  private _schema: any;
  private _rjsfToolbar: Widget;
}
